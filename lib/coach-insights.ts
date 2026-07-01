import "server-only";
import { prisma } from "@/lib/db";
import { snapshotSelect } from "@/lib/schema-assignments";
import {
  snapshotOf,
  asSnapshot,
  diffSnapshots,
  summarizeDiff,
} from "@/lib/schema-diff";

/**
 * Coach-analyse: aggregaties over de persoonlijke kopieën t.o.v. hun master-
 * baseline. Niet gecached — toont altijd de actuele drift (lichtgewicht: enkele
 * tientallen toewijzingen per tenant). Tenant-scoping via de verplichte
 * `tenantId`-filters.
 */

export type CoachInsights = {
  topOverriddenExercises: { exerciseId: string; name: string; count: number }[];
  membersWithOverrides: { userId: string; name: string; count: number }[];
  deviatingSchemas: { masterId: string; name: string; deviating: number; total: number }[];
  laggingMembers: { userId: string; name: string; daysSince: number | null }[];
  totals: { assignments: number; personalized: number };
};

const LAG_DAYS = 10;

export async function getCoachInsights(tenantId: string): Promise<CoachInsights> {
  const [assignments, exercises, lastSessions, masters] = await Promise.all([
    prisma.assignedWorkout.findMany({
      where: { tenantId, status: { not: "ARCHIVED" }, sourceTemplateId: { not: null } },
      select: {
        userId: true,
        sourceTemplateId: true,
        baselineSnapshot: true,
        status: true,
        user: { select: { name: true, email: true } },
        template: { select: { ...snapshotSelect } },
      },
    }),
    prisma.exercise.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    prisma.workoutSession.groupBy({
      by: ["userId"],
      where: { tenantId },
      _max: { startedAt: true },
    }),
    prisma.workoutTemplate.findMany({
      where: { tenantId, isLibrary: true },
      select: { id: true, name: true },
    }),
  ]);

  const names: Record<string, string> = Object.fromEntries(exercises.map((e) => [e.id, e.name]));
  const masterName: Record<string, string> = Object.fromEntries(masters.map((m) => [m.id, m.name]));
  const exerciseCount = new Map<string, number>();
  const memberCount = new Map<string, { name: string; count: number }>();
  const masterAgg = new Map<string, { name: string; deviating: number; total: number }>();
  let personalizedTotal = 0;

  for (const a of assignments) {
    const baseline = asSnapshot(a.baselineSnapshot);
    if (!a.template || !baseline || !a.sourceTemplateId) continue;
    const diff = diffSnapshots(baseline, snapshotOf(a.template));
    const summary = summarizeDiff(diff);

    const master = masterAgg.get(a.sourceTemplateId) ?? {
      name: masterName[a.sourceTemplateId] ?? "Schema",
      deviating: 0,
      total: 0,
    };
    master.total += 1;
    if (summary.total > 0) {
      master.deviating += 1;
      personalizedTotal += 1;
      // Per-lid override-teller.
      const memberName = a.user.name ?? a.user.email;
      const mc = memberCount.get(a.userId) ?? { name: memberName, count: 0 };
      mc.count += summary.total;
      memberCount.set(a.userId, mc);
      // Per-oefening override-teller.
      for (const e of diff.entries) {
        exerciseCount.set(e.exerciseId, (exerciseCount.get(e.exerciseId) ?? 0) + 1);
      }
    }
    masterAgg.set(a.sourceTemplateId, master);
  }

  const topOverriddenExercises = [...exerciseCount.entries()]
    .map(([exerciseId, count]) => ({ exerciseId, name: names[exerciseId] ?? "Oefening", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const membersWithOverrides = [...memberCount.entries()]
    .map(([userId, v]) => ({ userId, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const deviatingSchemas = [...masterAgg.entries()]
    .map(([masterId, v]) => ({ masterId, name: v.name, deviating: v.deviating, total: v.total }))
    .sort((a, b) => b.deviating - a.deviating);

  // Achterlopers: leden met een actief schema die lang niet trainden.
  const lastByUser = new Map<string, Date | null>();
  for (const s of lastSessions) lastByUser.set(s.userId, s._max.startedAt);
  const now = Date.now();
  const activeMemberIds = new Map<string, string>();
  for (const a of assignments) {
    if (a.status === "PUBLISHED") activeMemberIds.set(a.userId, a.user.name ?? a.user.email);
  }
  const laggingMembers = [...activeMemberIds.entries()]
    .map(([userId, name]) => {
      const last = lastByUser.get(userId) ?? null;
      const daysSince = last ? Math.floor((now - last.getTime()) / 86_400_000) : null;
      return { userId, name, daysSince };
    })
    .filter((m) => m.daysSince === null || m.daysSince >= LAG_DAYS)
    .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999))
    .slice(0, 10);

  return {
    topOverriddenExercises,
    membersWithOverrides,
    deviatingSchemas,
    laggingMembers,
    totals: { assignments: assignments.length, personalized: personalizedTotal },
  };
}

// --- Slimme suggesties (per master) -----------------------------------------

export type MasterSuggestion = {
  /** Stabiele id, decodeerbaar door applyMasterSuggestion. */
  id: string;
  kind: "replace" | "add" | "remove";
  dayIndex: number;
  count: number;
  total: number;
  text: string;
};

const SUGGESTION_MIN = 3;

/**
 * Detecteer veelvoorkomende identieke aanpassingen over de toewijzingen van één
 * master: dezelfde oefening vervangen/toevoegen/verwijderen door ≥ SUGGESTION_MIN
 * leden → suggereer het in de master door te voeren.
 */
export async function getMasterSuggestions(
  tenantId: string,
  masterId: string
): Promise<MasterSuggestion[]> {
  const [assignments, exercises] = await Promise.all([
    prisma.assignedWorkout.findMany({
      where: { tenantId, sourceTemplateId: masterId, status: { not: "ARCHIVED" } },
      select: { baselineSnapshot: true, template: { select: { ...snapshotSelect } } },
    }),
    prisma.exercise.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);
  const names: Record<string, string> = Object.fromEntries(exercises.map((e) => [e.id, e.name]));
  const total = assignments.length;
  if (total === 0) return [];

  const tally = new Map<string, { kind: MasterSuggestion["kind"]; dayIndex: number; count: number; ex: string; from?: string }>();
  for (const a of assignments) {
    const baseline = asSnapshot(a.baselineSnapshot);
    if (!a.template || !baseline) continue;
    const diff = diffSnapshots(baseline, snapshotOf(a.template));
    const seen = new Set<string>();
    for (const e of diff.entries) {
      let key: string | null = null;
      if (e.kind === "replaced" && e.fromExerciseId) {
        key = `replace:${e.dayIndex}:${e.fromExerciseId}:${e.exerciseId}`;
      } else if (e.kind === "added") {
        key = `add:${e.dayIndex}:${e.exerciseId}`;
      } else if (e.kind === "removed") {
        key = `remove:${e.dayIndex}:${e.exerciseId}`;
      }
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const cur = tally.get(key) ?? {
        kind: e.kind === "replaced" ? "replace" : e.kind === "added" ? "add" : "remove",
        dayIndex: e.dayIndex,
        count: 0,
        ex: e.exerciseId,
        from: e.fromExerciseId,
      };
      cur.count += 1;
      tally.set(key, cur);
    }
  }

  return [...tally.entries()]
    .filter(([, v]) => v.count >= SUGGESTION_MIN)
    .map(([id, v]) => ({
      id,
      kind: v.kind,
      dayIndex: v.dayIndex,
      count: v.count,
      total,
      text:
        v.kind === "replace"
          ? `${v.count} leden vervingen ${names[v.from ?? ""] ?? "een oefening"} door ${names[v.ex] ?? "een andere"}`
          : v.kind === "add"
            ? `${v.count} leden voegden ${names[v.ex] ?? "een oefening"} toe`
            : `${v.count} leden verwijderden ${names[v.ex] ?? "een oefening"}`,
    }))
    .sort((a, b) => b.count - a.count);
}
