import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getGoals, getGoalsBulk } from "@/lib/measurements";
import { loadMemberSessions } from "@/lib/member-stats";
import type { MetricKey } from "@/lib/achievements/definitions";

/**
 * Berekent alle metric-waarden voor één lid — de enige plek die de ruwe
 * trainings-/meet-/doeldata omzet naar de getallen waarop de achievement-registry
 * (lib/achievements/definitions.ts) drempelt. Alles wordt afgeleid uit bestaande
 * data (`WorkoutSession`/`PerformanceEntry`/`Measurement`/`MemberGoal`/`User`) —
 * geen extra opslag. Tenant-scoped via expliciete `tenantId` (net als
 * lib/member-stats.ts), Epley-1RM consistent met de rest van de app.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Oefeningstypes die als "cardio" meetellen voor afstand/tijd-metrics. */
const CARDIO_TYPES = new Set(["cardio", "endurance", "hiit", "circuit"]);

export type MemberMetrics = Record<MetricKey, number>;

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function paramNumber(params: unknown, key: string): number {
  if (!params || typeof params !== "object" || Array.isArray(params)) return 0;
  const v = (params as Record<string, unknown>)[key];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Langste reeks aaneengesloten kalenderdagen met minstens één training. */
function longestDayStreak(dayStarts: Set<number>): number {
  if (dayStarts.size === 0) return 0;
  const sorted = [...dayStarts].sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] - sorted[i - 1] === DAY_MS ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return longest;
}

// --- Pure kern -------------------------------------------------------------
// De data-inputs die de metric-berekening nodig heeft. Bewust minimaal getypeerd
// (structureel) zodat zowel de per-lid- als de bulk-fetch hun rijen kunnen doorgeven.

type MetricsSessionInput = {
  startedAt: Date;
  performanceEntries: readonly {
    reps: number;
    weightKg: number;
    params: Prisma.JsonValue;
    exercise: { name: string; exerciseType: string };
  }[];
};

type MetricsUserInput = {
  createdAt: Date;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  birthDate: Date | null;
  trainingGoals: Prisma.JsonValue;
} | null;

type MetricsMeasurementInput = { bodyFatPct: number | null; muscleMassKg: number | null };

/**
 * Zuivere metric-berekening: dezelfde math voor één lid ([[computeMemberMetrics]]) en
 * voor een batch ([[computeMemberMetricsBulk]]). `sessions` moet **alleen afgeronde**
 * sessies bevatten (callers filteren vooraf). Géén I/O — puur in-memory.
 */
function computeMetrics(
  sessions: readonly MetricsSessionInput[],
  user: MetricsUserInput,
  goals: readonly { achieved: boolean }[],
  measurements: readonly MetricsMeasurementInput[],
  archivedSchemas: number
): MemberMetrics {
  let totalWorkouts = 0;
  let totalVolume = 0;
  let totalDistanceM = 0;
  let totalCardioSec = 0;
  let longestRunM = 0;
  let maxSquatKg = 0;
  let maxDeadliftKg = 0;
  const dayStarts = new Set<number>();
  const weekBuckets = new Set<number>(); // distinct 7-daagse weken met ≥1 training
  const prExercises = new Set<string>(); // oefeningen met ≥1 gewogen set = een record

  for (const s of sessions) {
    totalWorkouts += 1;
    const day = startOfDay(s.startedAt);
    dayStarts.add(day);
    // Distinct kalenderweken (7-daagse buckets vanaf epoch) met ≥1 training.
    // Alignment is irrelevant — het gaat om het áántal getrainde weken.
    weekBuckets.add(Math.floor(day / (7 * DAY_MS)));
    for (const e of s.performanceEntries) {
      totalVolume += e.reps * e.weightKg;
      if (e.weightKg > 0) {
        prExercises.add(e.exercise.name);
        const name = e.exercise.name.toLowerCase();
        if (name.includes("squat") || name.includes("kniebuig")) {
          maxSquatKg = Math.max(maxSquatKg, e.weightKg);
        }
        if (name.includes("deadlift") || name.includes("dead lift")) {
          maxDeadliftKg = Math.max(maxDeadliftKg, e.weightKg);
        }
      }
      if (CARDIO_TYPES.has(e.exercise.exerciseType)) {
        const dist = paramNumber(e.params, "distanceM");
        const time = paramNumber(e.params, "timeSeconds");
        totalDistanceM += dist;
        totalCardioSec += time;
        if (dist > longestRunM) longestRunM = dist;
      }
    }
  }

  const memberSinceDays = user
    ? Math.floor((Date.now() - user.createdAt.getTime()) / DAY_MS)
    : 0;

  const trainingGoals = Array.isArray(user?.trainingGoals) ? user.trainingGoals : [];
  const profileComplete =
    user?.firstName && user?.lastName && user?.phone && user?.birthDate && trainingGoals.length > 0
      ? 1
      : 0;

  // Lichaamssamenstelling: eerste vs. laatste meting met een waarde.
  const bfValues = measurements.map((m) => m.bodyFatPct).filter((v): v is number => v != null);
  const mmValues = measurements.map((m) => m.muscleMassKg).filter((v): v is number => v != null);
  const bodyFatImproved =
    bfValues.length >= 2 && bfValues[bfValues.length - 1] < bfValues[0] ? 1 : 0;
  const muscleGained =
    mmValues.length >= 2 && mmValues[mmValues.length - 1] > mmValues[0] ? 1 : 0;

  return {
    totalWorkouts,
    longestStreakDays: longestDayStreak(dayStarts),
    activeWeeks: weekBuckets.size,
    memberSinceDays,
    totalVolume: Math.round(totalVolume),
    prCount: prExercises.size,
    maxSquatKg,
    maxDeadliftKg,
    longestRunM,
    totalDistanceM,
    totalCardioSec,
    goalsAchieved: goals.filter((g) => g.achieved).length,
    bodyFatImproved,
    muscleGained,
    measurementsCount: measurements.length,
    profileComplete,
    schemasCompleted: archivedSchemas,
  };
}

const USER_METRICS_SELECT = {
  createdAt: true,
  firstName: true,
  lastName: true,
  phone: true,
  birthDate: true,
  trainingGoals: true,
} as const;

export async function computeMemberMetrics(
  memberId: string,
  tenantId: string
): Promise<MemberMetrics> {
  const [sessions, user, goals, measurements, archivedSchemas] = await Promise.all([
    // Gedeelde, per-request gecachete historie-loader (zie lib/member-stats.ts):
    // op `/member` deelt dit dezelfde fetch als getMemberStats i.p.v. de volledige
    // historie tweemaal te scannen. Bevat álle sessies — we filteren op afgerond
    // (`endedAt`), wat voorheen het DB-`where` deed.
    loadMemberSessions(memberId, tenantId),
    prisma.user.findFirst({ where: { id: memberId, tenantId }, select: USER_METRICS_SELECT }),
    getGoals(tenantId, memberId),
    prisma.measurement.findMany({
      where: { tenantId, userId: memberId },
      orderBy: { measuredAt: "asc" },
      select: { bodyFatPct: true, muscleMassKg: true },
    }),
    prisma.assignedWorkout.count({ where: { tenantId, userId: memberId, status: "ARCHIVED" } }),
  ]);

  return computeMetrics(
    sessions.filter((s) => s.endedAt != null),
    user,
    goals,
    measurements,
    archivedSchemas
  );
}

/**
 * Bulk-variant van [[computeMemberMetrics]]: berekent de metrics voor meerdere leden
 * met een **vast** aantal queries (i.p.v. ~5 per lid). Gebruikt door de coach-
 * betrokkenheidsberekening om de N+1 over "bijna behaald"-kandidaten te elimineren.
 * De math is identiek — dezelfde [[computeMetrics]]-kern.
 */
export async function computeMemberMetricsBulk(
  memberIds: string[],
  tenantId: string
): Promise<Map<string, MemberMetrics>> {
  const out = new Map<string, MemberMetrics>();
  if (memberIds.length === 0) return out;

  const [sessions, users, goalsByUser, measurements, archivedGroups] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { tenantId, userId: { in: memberIds }, endedAt: { not: null } },
      select: {
        userId: true,
        startedAt: true,
        performanceEntries: {
          select: {
            reps: true,
            weightKg: true,
            params: true,
            exercise: { select: { name: true, exerciseType: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { tenantId, id: { in: memberIds } },
      select: { id: true, ...USER_METRICS_SELECT },
    }),
    getGoalsBulk(tenantId, memberIds),
    prisma.measurement.findMany({
      where: { tenantId, userId: { in: memberIds } },
      orderBy: { measuredAt: "asc" },
      select: { userId: true, bodyFatPct: true, muscleMassKg: true },
    }),
    prisma.assignedWorkout.groupBy({
      by: ["userId"],
      where: { tenantId, userId: { in: memberIds }, status: "ARCHIVED" },
      _count: true,
    }),
  ]);

  const sessionsByUser = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const arr = sessionsByUser.get(s.userId);
    if (arr) arr.push(s);
    else sessionsByUser.set(s.userId, [s]);
  }
  const userById = new Map(users.map((u) => [u.id, u]));
  const measByUser = new Map<string, typeof measurements>();
  for (const m of measurements) {
    const arr = measByUser.get(m.userId);
    if (arr) arr.push(m);
    else measByUser.set(m.userId, [m]);
  }
  const archivedByUser = new Map(archivedGroups.map((g) => [g.userId, g._count]));

  for (const memberId of memberIds) {
    out.set(
      memberId,
      computeMetrics(
        sessionsByUser.get(memberId) ?? [],
        userById.get(memberId) ?? null,
        goalsByUser.get(memberId) ?? [],
        measByUser.get(memberId) ?? [],
        archivedByUser.get(memberId) ?? 0
      )
    );
  }
  return out;
}
