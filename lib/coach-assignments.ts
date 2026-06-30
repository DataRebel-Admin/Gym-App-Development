import "server-only";
import { prisma } from "@/lib/db";

export type CoachRef = {
  assignmentId: string;
  coachId: string;
  name: string | null;
  email: string;
  role: "TENANT_ADMIN" | "TENANT_STAFF";
};

/** Coaches die aan een lid zijn gekoppeld. */
export async function listMemberCoaches(
  tenantId: string,
  memberId: string
): Promise<CoachRef[]> {
  const rows = await prisma.coachAssignment.findMany({
    where: { tenantId, memberId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      coachId: true,
      coach: { select: { name: true, email: true, role: true } },
    },
  });
  return rows.map((r) => ({
    assignmentId: r.id,
    coachId: r.coachId,
    name: r.coach.name,
    email: r.coach.email,
    role: r.coach.role as "TENANT_ADMIN" | "TENANT_STAFF",
  }));
}

/** Actieve coaches (eigenaar + medewerkers) die aan leden gekoppeld kunnen worden. */
export async function listAvailableCoaches(tenantId: string) {
  return prisma.user.findMany({
    where: {
      tenantId,
      active: true,
      archivedAt: null,
      role: { in: ["TENANT_ADMIN", "TENANT_STAFF"] },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
}

/** Aantal leden dat een coach begeleidt. */
export async function countCoachMembers(
  tenantId: string,
  coachId: string
): Promise<number> {
  return prisma.coachAssignment.count({ where: { tenantId, coachId } });
}

export type CoachMemberRow = {
  memberId: string;
  name: string | null;
  email: string;
};

/** Leden die door een coach worden begeleid (voor "Mijn leden"). */
export async function listCoachMembers(
  tenantId: string,
  coachId: string,
  take?: number
): Promise<CoachMemberRow[]> {
  const rows = await prisma.coachAssignment.findMany({
    where: { tenantId, coachId, member: { archivedAt: null } },
    orderBy: { member: { name: "asc" } },
    ...(take ? { take } : {}),
    select: { memberId: true, member: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({
    memberId: r.memberId,
    name: r.member.name,
    email: r.member.email,
  }));
}
