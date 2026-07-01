import "server-only";
import type { AssignmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isActiveNow, fmtDate, fmtDateTime, fmtSince, computeValidity } from "@/lib/schema-status";
import { snapshotOf, asSnapshot, diffSnapshots, hasAnyDiff } from "@/lib/schema-diff";
import type { OverviewRow } from "@/components/schema-assignment-overview";

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
  /** Geldigheidsduur van dit schema in weken (null = onbeperkt). */
  validityWeeks: number | null;
  /** Persoonlijke kopie wijkt af van de master-baseline. */
  personalized: boolean;
  /** Master is gewijzigd sinds de laatste sync → synchronisatie beschikbaar. */
  syncAvailable: boolean;
};

/** Genormaliseerde-snapshot select voor diff-berekening op een kloon/master. */
export const snapshotSelect = {
  coachNote: true,
  days: {
    orderBy: { order: "asc" as const },
    select: {
      name: true,
      notes: true,
      order: true,
      items: {
        orderBy: { order: "asc" as const },
        select: {
          exerciseId: true,
          order: true,
          sets: true,
          reps: true,
          restSeconds: true,
          weightKg: true,
          tempo: true,
          params: true,
          notes: true,
        },
      },
    },
  },
} as const;

/**
 * Alle (niet-gearchiveerde) toewijzingen die uit één library-template zijn
 * gekloond, voor het owner-overzicht: aan welke leden, status, datums, laatst
 * gewijzigd. Tenant-scoping wordt door de caller afgedwongen via tenantId.
 */
export async function getAssignmentsForTemplate(
  tenantId: string,
  sourceTemplateId: string
): Promise<AssignmentRow[]> {
  // Master één keer ophalen → snapshot voor de sync-detectie van álle rijen.
  const master = await prisma.workoutTemplate.findFirst({
    where: { id: sourceTemplateId, tenantId },
    select: { updatedAt: true, ...snapshotSelect },
  });
  const masterSnap = master ? snapshotOf(master) : null;
  const masterUpdatedAt = master?.updatedAt ?? null;

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
      baselineSnapshot: true,
      masterSyncedAt: true,
      template: { select: { updatedAt: true, validityWeeks: true, ...snapshotSelect } },
      user: { select: { name: true, email: true } },
    },
  });

  return rows.map((r) => {
    const baseline = asSnapshot(r.baselineSnapshot);
    let personalized = false;
    let syncAvailable = false;
    if (baseline && r.template) {
      personalized = hasAnyDiff(diffSnapshots(baseline, snapshotOf(r.template)));
    }
    if (baseline && masterSnap && masterUpdatedAt) {
      const changedSince = r.masterSyncedAt
        ? masterUpdatedAt.getTime() > r.masterSyncedAt.getTime()
        : false;
      syncAvailable = changedSince && hasAnyDiff(diffSnapshots(baseline, masterSnap));
    }
    return {
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
      validityWeeks: r.template?.validityWeeks ?? null,
      personalized,
      syncAvailable,
    };
  });
}

/**
 * Serialiseert de toewijs-rijen voor het (client-)overzichtscomponent: alle
 * datums worden hier server-side geformatteerd (geen Date-objecten of relatieve
 * tijd op de client → geen hydration-mismatch).
 */
export function toOverviewRows(rows: AssignmentRow[], now: Date = new Date()): OverviewRow[] {
  return rows.map((r) => {
    const validity = computeValidity(r.publishedAt, r.validityWeeks, now);
    return {
      id: r.id,
      memberName: r.memberName,
      status: r.status,
      personalized: r.personalized,
      syncAvailable: r.syncAvailable,
      active: r.active,
      availableOrPublished:
        r.status === "SCHEDULED" ? fmtDateTime(r.availableFrom) : fmtDate(r.publishedAt),
      period: r.startDate
        ? `${fmtDate(r.startDate)}${r.endDate ? ` – ${fmtDate(r.endDate)}` : ""}`
        : r.endDate
          ? `t/m ${fmtDate(r.endDate)}`
          : "—",
      changed: fmtDate(r.updatedAt),
      sinceLabel: r.publishedAt ? fmtSince(r.publishedAt, now) : "",
      seen: r.status !== "PUBLISHED" ? "na" : r.seenAt ? "seen" : "new",
      validityState: validity.state,
      validityLabel: validity.label,
      validityTone: validity.tone,
      validityExpires: validity.expiresAt ? fmtDate(validity.expiresAt) : "",
    };
  });
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
      template: {
        select: {
          id: true,
          name: true,
          updatedAt: true,
          validityWeeks: true,
          _count: { select: { items: true } },
        },
      },
    },
  });
}
