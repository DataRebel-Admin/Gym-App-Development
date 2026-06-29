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
  sort?: "name" | "created" | "status";
  includeArchived?: boolean;
};

const STATUS_ORDER: Record<InviteStatus, number> = {
  NIET_UITGENODIGD: 0,
  VERZONDEN: 1,
  VERLOPEN: 2,
  GEACTIVEERD: 3,
};

/** Leden van een tenant met afgeleide uitnodigingsstatus, gefilterd/gesorteerd. */
export async function listMembers(
  tenantId: string,
  opts: MemberListOptions = {}
): Promise<MemberRow[]> {
  const where: Prisma.UserWhereInput = {
    tenantId,
    role: { in: ["TENANT_ADMIN", "TENANT_MEMBER"] },
    ...(opts.includeArchived ? {} : { archivedAt: null }),
    ...(opts.role ? { role: opts.role } : {}),
    ...(opts.q
      ? {
          OR: [
            { name: { contains: opts.q, mode: "insensitive" } },
            { email: { contains: opts.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, invitations] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        archivedAt: true,
        createdAt: true,
        emailVerified: true,
      },
    }),
    prisma.invitation.findMany({
      where: { tenantId },
      select: { email: true, acceptedAt: true, expiresAt: true },
    }),
  ]);

  const inviteByEmail = new Map(invitations.map((i) => [i.email, i]));

  let rows: MemberRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    archivedAt: u.archivedAt,
    createdAt: u.createdAt,
    inviteStatus: deriveInviteStatus(u, inviteByEmail.get(u.email)),
  }));

  if (opts.status) rows = rows.filter((r) => r.inviteStatus === opts.status);

  const sort = opts.sort ?? "name";
  rows.sort((a, b) => {
    if (sort === "created") return b.createdAt.getTime() - a.createdAt.getTime();
    if (sort === "status")
      return STATUS_ORDER[a.inviteStatus] - STATUS_ORDER[b.inviteStatus];
    return (a.name ?? a.email).localeCompare(b.name ?? b.email);
  });

  return rows;
}
