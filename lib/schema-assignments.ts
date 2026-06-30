import "server-only";
import type { AssignmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isActiveNow } from "@/lib/schema-status";

export type AssignmentRow = {
  id: string;
  userId: string;
  memberName: string;
  memberEmail: string;
  status: AssignmentStatus;
  availableFrom: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  publishedAt: Date | null;
  seenAt: Date | null;
  updatedAt: Date;
  active: boolean;
};

/**
 * Alle (niet-gearchiveerde) toewijzingen die uit één library-template zijn
 * gekloond, voor het owner-overzicht: aan welke leden, status, datums, laatst
 * gewijzigd. Tenant-scoping wordt door de caller afgedwongen via tenantId.
 */
export async function getAssignmentsForTemplate(
  tenantId: string,
  sourceTemplateId: string
): Promise<AssignmentRow[]> {
  const rows = await prisma.assignedWorkout.findMany({
    where: { tenantId, sourceTemplateId, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      status: true,
      availableFrom: true,
      startDate: true,
      endDate: true,
      publishedAt: true,
      seenAt: true,
      template: { select: { updatedAt: true } },
      user: { select: { name: true, email: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    memberName: r.user.name ?? r.user.email,
    memberEmail: r.user.email,
    status: r.status,
    availableFrom: r.availableFrom,
    startDate: r.startDate,
    endDate: r.endDate,
    publishedAt: r.publishedAt,
    seenAt: r.seenAt,
    updatedAt: r.template?.updatedAt ?? r.publishedAt ?? new Date(),
    active: isActiveNow(r),
  }));
}

/** Alle toewijzingen van één lid (voor de per-lid-pagina). */
export async function getAssignmentsForMember(tenantId: string, userId: string) {
  return prisma.assignedWorkout.findMany({
    where: { tenantId, userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      availableFrom: true,
      startDate: true,
      endDate: true,
      publishedAt: true,
      seenAt: true,
      trainerMessage: true,
      template: { select: { id: true, name: true, updatedAt: true, _count: { select: { items: true } } } },
    },
  });
}
