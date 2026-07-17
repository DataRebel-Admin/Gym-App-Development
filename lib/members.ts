import "server-only";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";

export type InviteStatus =
  | "GEACTIVEERD"
  | "VERZONDEN"
  | "VERLOPEN"
  | "NIET_UITGENODIGD";

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  GEACTIVEERD: "Account geactiveerd",
  VERZONDEN: "Uitnodiging verzonden",
  VERLOPEN: "Uitnodiging verlopen",
  NIET_UITGENODIGD: "Niet uitgenodigd",
};

export type MemberRow = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  active: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  inviteStatus: InviteStatus;
};

type Invitation = { acceptedAt: Date | null; expiresAt: Date };

export function deriveInviteStatus(
  user: { emailVerified: Date | null },
  invitation: Invitation | undefined
): InviteStatus {
  if (user.emailVerified) return "GEACTIVEERD";
  if (invitation?.acceptedAt) return "GEACTIVEERD";
  if (invitation && invitation.expiresAt > new Date()) return "VERZONDEN";
  if (invitation) return "VERLOPEN";
  return "NIET_UITGENODIGD";
}

export type MemberListOptions = {
  q?: string;
  status?: InviteStatus;
  role?: Role;
  /** Beperk tot leden die door deze coach worden begeleid ("Mijn leden"). */
  coachId?: string;
  sort?: "name" | "created" | "status";
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
};

export type MemberListResult = {
  rows: MemberRow[];
  total: number;
  page: number;
  totalPages: number;
};

const STATUS_ORDER: Record<InviteStatus, number> = {
  NIET_UITGENODIGD: 0,
  VERZONDEN: 1,
  VERLOPEN: 2,
  GEACTIVEERD: 3,
};

/**
 * Leden van een tenant met afgeleide uitnodigingsstatus, gepagineerd op DB-niveau
 * (schaalt naar duizenden leden). Let op: een status-filter werkt binnen de pagina
 * (de status is afgeleid en niet DB-queryable).
 */
export async function listMembers(
  tenantId: string,
  opts: MemberListOptions = {}
): Promise<MemberListResult> {
  const where: Prisma.UserWhereInput = {
    tenantId,
    role: { in: ["TENANT_ADMIN", "TENANT_MEMBER"] },
    ...(opts.includeArchived ? {} : { archivedAt: null }),
    ...(opts.role ? { role: opts.role } : {}),
    ...(opts.coachId ? { assignedCoaches: { some: { tenantId, coachId: opts.coachId } } } : {}),
    ...(opts.q
      ? {
          OR: [
            { name: { contains: opts.q, mode: "insensitive" } },
            { email: { contains: opts.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const pageSize = opts.pageSize ?? 25;
  const page = Math.max(1, opts.page ?? 1);
  const sort = opts.sort ?? "name";

  const select = {
    id: true,
    email: true,
    name: true,
    role: true,
    active: true,
    archivedAt: true,
    createdAt: true,
    emailVerified: true,
  } as const;

  const toRow = (
    u: Prisma.UserGetPayload<{ select: typeof select }>,
    inviteByEmail: Map<string, Invitation>
  ): MemberRow => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    archivedAt: u.archivedAt,
    createdAt: u.createdAt,
    inviteStatus: deriveInviteStatus(u, inviteByEmail.get(u.email)),
  });

  const loadInvites = async (emails: string[]) => {
    const invitations = await prisma.invitation.findMany({
      where: { tenantId, email: { in: emails } },
      select: { email: true, acceptedAt: true, expiresAt: true },
    });
    return new Map(invitations.map((i) => [i.email, i]));
  };

  // De uitnodigingsstatus is afgeleid (emailVerified + invitation) en dus niet
  // DB-queryable. Wordt er op status gefilterd óf gesorteerd, dan moet dat over
  // álle matchende leden — anders klopt total/totalPages niet en mis je treffers
  // buiten de eerste pagina. In dat geval: alles ophalen → status afleiden →
  // filteren/sorteren → in-memory pagineren. Zonder statusfilter blijft de
  // efficiënte DB-paginatie (schaalt naar duizenden leden).
  if (opts.status || sort === "status") {
    const users = await prisma.user.findMany({ where, select });
    const inviteByEmail = await loadInvites(users.map((u) => u.email));
    let rows = users.map((u) => toRow(u, inviteByEmail));

    if (opts.status) rows = rows.filter((r) => r.inviteStatus === opts.status);
    rows.sort((a, b) => {
      if (sort === "status")
        return STATUS_ORDER[a.inviteStatus] - STATUS_ORDER[b.inviteStatus];
      if (sort === "created") return b.createdAt.getTime() - a.createdAt.getTime();
      return (a.name ?? "").localeCompare(b.name ?? "");
    });

    const total = rows.length;
    const start = (page - 1) * pageSize;
    return {
      rows: rows.slice(start, start + pageSize),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const orderBy: Prisma.UserOrderByWithRelationInput =
    sort === "created" ? { createdAt: "desc" } : { name: "asc" };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select,
    }),
  ]);

  const inviteByEmail = await loadInvites(users.map((u) => u.email));
  const rows = users.map((u) => toRow(u, inviteByEmail));

  return { rows, total, page, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
