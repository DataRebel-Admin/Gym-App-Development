import "server-only";
import { prisma } from "@/lib/db";
import { getGoals } from "@/lib/measurements";
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

export async function computeMemberMetrics(
  memberId: string,
  tenantId: string
): Promise<MemberMetrics> {
  const [sessions, user, goals, measurements, archivedSchemas] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { tenantId, userId: memberId, endedAt: { not: null } },
      select: {
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
    prisma.user.findFirst({
      where: { id: memberId, tenantId },
      select: {
        createdAt: true,
        firstName: true,
        lastName: true,
        phone: true,
        birthDate: true,
        trainingGoals: true,
      },
    }),
    getGoals(tenantId, memberId),
    prisma.measurement.findMany({
      where: { tenantId, userId: memberId },
      orderBy: { measuredAt: "asc" },
      select: { bodyFatPct: true, muscleMassKg: true },
    }),
    prisma.assignedWorkout.count({ where: { tenantId, userId: memberId, status: "ARCHIVED" } }),
  ]);

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
