import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Read-only progressie-/motivatie-aggregaties voor de sporter-app. Géén mutaties,
 * géén schema-wijziging: alles wordt afgeleid uit bestaande `WorkoutSession` +
 * `PerformanceEntry`. Tenant-scoped via expliciete `tenantId` (zoals
 * [[getMemberHistory]] in lib/member.ts). De 1RM-schatting gebruikt Epley
 * (`gewicht × (1 + reps/30)`), consistent met `getExerciseProgress`.
 */

/** Default weekdoel (aantal trainingen). Nog geen DB-veld — later configureerbaar. */
export const MEMBER_WEEKLY_GOAL = 3;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Maandag 00:00 van de week waarin `d` valt (lokale tijd). */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // ma=0 … zo=6
  x.setDate(x.getDate() - dow);
  return x;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function epley(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

export type WeekVolumePoint = { label: string; volume: number };
export type MuscleGroupCount = { muscle: string; sets: number; pct: number };
export type PersonalRecord = {
  exerciseId: string;
  name: string;
  weightKg: number;
  reps: number;
  oneRm: number;
  achievedAt: Date;
};
export type HeatmapDay = { date: string; count: number };

export type MemberStats = {
  weeklyGoal: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  totalWorkouts: number;
  currentStreakWeeks: number;
  longestStreakWeeks: number;
  totalDurationSec: number;
  /** Totaal getild volume Σ(reps·kg) over alle sessies. */
  totalVolume: number;
  thisWeekVolume: number;
  thisWeekDurationSec: number;
  /** Laatste 12 weken Σ(reps·kg). */
  weekVolume: WeekVolumePoint[];
  /** Spiergroep-verdeling over de laatste 28 dagen (op set-aantal). */
  muscleGroups: MuscleGroupCount[];
  /** Beste PR's (op geschatte 1RM, aflopend). */
  records: PersonalRecord[];
  /** PR's behaald in de laatste 30 dagen. */
  recentRecords: PersonalRecord[];
  /** Laatste ~16 weken trainingsdagen (voor de heatmap). */
  heatmap: HeatmapDay[];
  lastSessionAt: Date | null;
};

export type MemberSessionRow = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  performanceEntries: {
    reps: number;
    weightKg: number;
    exerciseId: string;
    params: Prisma.JsonValue;
    exercise: {
      name: string;
      exerciseType: string;
      targetMuscle: string | null;
      catalog: { target: string | null; muscleGroup: string | null } | null;
    };
  }[];
};

/**
 * Laadt de volledige sessie-/prestatiehistorie van één lid — de gedeelde bron voor
 * álle read-only aggregaties (stats, records, workout-context, achievements-metrics).
 * Per-request gememoïseerd met React `cache()` zodat een pagina die zowel
 * [[getMemberStats]] als de achievements-metrics gebruikt (bv. `/member`) de historie
 * **één keer** ophaalt i.p.v. per aggregator opnieuw. De `select` is een superset:
 * `params`/`exerciseType` voor de achievements-metrics, `catalog`/`targetMuscle` voor
 * de spiergroep-analyse hier. Bevat álle sessies (ook lopende); consumenten filteren
 * zelf op `endedAt` waar nodig.
 */
export const loadMemberSessions = cache(
  async (memberId: string, tenantId: string): Promise<MemberSessionRow[]> => {
    return prisma.workoutSession.findMany({
      where: { tenantId, userId: memberId },
      orderBy: { startedAt: "asc" },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        performanceEntries: {
          select: {
            reps: true,
            weightKg: true,
            exerciseId: true,
            params: true,
            exercise: {
              select: {
                name: true,
                exerciseType: true,
                targetMuscle: true,
                catalog: { select: { target: true, muscleGroup: true } },
              },
            },
          },
        },
      },
    });
  }
);

function muscleOf(entry: MemberSessionRow["performanceEntries"][number]): string | null {
  const raw =
    entry.exercise.catalog?.target ??
    entry.exercise.catalog?.muscleGroup ??
    entry.exercise.targetMuscle ??
    null;
  if (!raw) return null;
  // Normaliseer naar Title Case voor nette labels (catalogus is veelal lowercase).
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Tel aaneengesloten trainingsweken, met één week grace voor de lopende week. */
function computeStreaks(weekKeys: Set<number>, currentWeekKey: number) {
  if (weekKeys.size === 0) return { current: 0, longest: 0 };

  // Huidige streak: start bij deze week, of (grace) bij vorige week.
  let anchor = weekKeys.has(currentWeekKey)
    ? currentWeekKey
    : weekKeys.has(currentWeekKey - WEEK_MS)
      ? currentWeekKey - WEEK_MS
      : null;
  let current = 0;
  while (anchor != null && weekKeys.has(anchor)) {
    current += 1;
    anchor -= WEEK_MS;
  }

  // Langste streak: scan alle weken chronologisch.
  const sorted = [...weekKeys].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of sorted) {
    run = prev != null && k - prev === WEEK_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = k;
  }

  return { current, longest };
}

export async function getMemberStats(
  memberId: string,
  tenantId: string
): Promise<MemberStats> {
  const sessions = await loadMemberSessions(memberId, tenantId);
  const now = new Date();
  const weekStart = startOfWeek(now).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let totalWorkouts = 0;
  let workoutsThisWeek = 0;
  let workoutsThisMonth = 0;
  let totalDurationSec = 0;
  let totalVolume = 0;
  let thisWeekVolume = 0;
  let thisWeekDurationSec = 0;
  let lastSessionAt: Date | null = null;

  const weekKeys = new Set<number>();
  const dayCounts = new Map<number, number>(); // dayStart → sessies
  const volumeByWeek = new Map<number, number>(); // weekStart → volume

  // Spiergroepen (laatste 28 dagen) en PR's (all-time) in dezelfde pass.
  const muscleWindowStart = startOfDay(now).getTime() - 28 * DAY_MS;
  const muscleSets = new Map<string, number>();
  type Best = { exerciseId: string; name: string; weightKg: number; reps: number; oneRm: number; achievedAt: Date };
  const bestByExercise = new Map<string, Best>();

  for (const s of sessions) {
    const completed = s.endedAt != null;
    const wkStart = startOfWeek(s.startedAt).getTime();
    const dayKey = startOfDay(s.startedAt).getTime();
    const durationSec = s.endedAt
      ? Math.max(0, Math.floor((s.endedAt.getTime() - s.startedAt.getTime()) / 1000))
      : 0;

    if (completed) {
      totalWorkouts += 1;
      if (s.startedAt.getTime() >= weekStart) workoutsThisWeek += 1;
      if (s.startedAt.getTime() >= monthStart) workoutsThisMonth += 1;
      totalDurationSec += durationSec;
      weekKeys.add(wkStart);
      dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);
      if (!lastSessionAt || s.startedAt > lastSessionAt) lastSessionAt = s.startedAt;
      if (s.startedAt.getTime() >= weekStart) thisWeekDurationSec += durationSec;
    }

    let sessionVolume = 0;
    for (const e of s.performanceEntries) {
      const vol = e.reps * e.weightKg;
      sessionVolume += vol;

      // Spiergroepen binnen het venster.
      if (s.startedAt.getTime() >= muscleWindowStart) {
        const m = muscleOf(e);
        if (m) muscleSets.set(m, (muscleSets.get(m) ?? 0) + 1);
      }

      // PR per oefening (op 1RM; eerste sessie die het maximum haalt telt als datum).
      if (e.weightKg > 0) {
        const oneRm = epley(e.weightKg, e.reps);
        const cur = bestByExercise.get(e.exerciseId);
        if (!cur || oneRm > cur.oneRm) {
          bestByExercise.set(e.exerciseId, {
            exerciseId: e.exerciseId,
            name: e.exercise.name,
            weightKg: e.weightKg,
            reps: e.reps,
            oneRm,
            achievedAt: s.startedAt,
          });
        }
      }
    }

    volumeByWeek.set(wkStart, (volumeByWeek.get(wkStart) ?? 0) + sessionVolume);
    totalVolume += sessionVolume;
    if (s.startedAt.getTime() >= weekStart) thisWeekVolume += sessionVolume;
  }

  const { current: currentStreakWeeks, longest: longestStreakWeeks } =
    computeStreaks(weekKeys, weekStart);

  // Laatste 12 weken volume (incl. lege weken).
  const weekVolume: WeekVolumePoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const ws = weekStart - i * WEEK_MS;
    const d = new Date(ws);
    weekVolume.push({
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      volume: Math.round(volumeByWeek.get(ws) ?? 0),
    });
  }

  // Heatmap: laatste 112 dagen (16 weken).
  const heatmap: HeatmapDay[] = [];
  const todayStart = startOfDay(now).getTime();
  for (let i = 111; i >= 0; i--) {
    const ds = todayStart - i * DAY_MS;
    const d = new Date(ds);
    heatmap.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      count: dayCounts.get(ds) ?? 0,
    });
  }

  const totalMuscleSets = [...muscleSets.values()].reduce((a, b) => a + b, 0);
  const muscleGroups: MuscleGroupCount[] = [...muscleSets.entries()]
    .map(([muscle, sets]) => ({
      muscle,
      sets,
      pct: totalMuscleSets > 0 ? Math.round((sets / totalMuscleSets) * 100) : 0,
    }))
    .sort((a, b) => b.sets - a.sets);

  const records: PersonalRecord[] = [...bestByExercise.values()]
    .map((b) => ({ ...b, oneRm: Math.round(b.oneRm) }))
    .sort((a, b) => b.oneRm - a.oneRm);

  const recentCutoff = now.getTime() - 30 * DAY_MS;
  const recentRecords = records
    .filter((r) => r.achievedAt.getTime() >= recentCutoff)
    .sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime());

  return {
    weeklyGoal: MEMBER_WEEKLY_GOAL,
    workoutsThisWeek,
    workoutsThisMonth,
    totalWorkouts,
    currentStreakWeeks,
    longestStreakWeeks,
    totalDurationSec,
    totalVolume: Math.round(totalVolume),
    thisWeekVolume: Math.round(thisWeekVolume),
    thisWeekDurationSec,
    weekVolume,
    muscleGroups,
    records,
    recentRecords,
    heatmap,
    lastSessionAt,
  };
}

export type RecentSession = {
  id: string;
  startedAt: Date;
  durationSec: number;
  totalSets: number;
  totalVolume: number;
  exerciseCount: number;
  /** Top spiergroepen van deze sessie (max 3). */
  muscles: string[];
};

/** Afgeronde sessies als rijke kaart-data (datum, duur, volume, sets, spiergroepen). */
export async function getRecentSessions(
  memberId: string,
  tenantId: string,
  take = 20
): Promise<RecentSession[]> {
  const sessions = await loadMemberSessions(memberId, tenantId);
  return sessions
    .filter((s) => s.endedAt != null)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, take)
    .map((s) => {
      const exercises = new Set<string>();
      const muscleSets = new Map<string, number>();
      let totalVolume = 0;
      for (const e of s.performanceEntries) {
        exercises.add(e.exerciseId);
        totalVolume += e.reps * e.weightKg;
        const m = muscleOf(e);
        if (m) muscleSets.set(m, (muscleSets.get(m) ?? 0) + 1);
      }
      const muscles = [...muscleSets.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([m]) => m);
      return {
        id: s.id,
        startedAt: s.startedAt,
        durationSec: s.endedAt
          ? Math.max(0, Math.floor((s.endedAt.getTime() - s.startedAt.getTime()) / 1000))
          : 0,
        totalSets: s.performanceEntries.length,
        totalVolume: Math.round(totalVolume),
        exerciseCount: exercises.size,
        muscles,
      };
    });
}

export type WorkoutContext = {
  /** Beste geschatte 1RM per oefening uit álle ándere sessies (voor live PR-detectie). */
  historicalBest: Record<string, number>;
  /** Streak (weken) als deze sessie meetelt voor de huidige week. */
  projectedStreakWeeks: number;
  weeklyGoal: number;
  /** Aantal trainingen deze week inclusief deze (lopende) sessie. */
  workoutsThisWeekIncl: number;
  weeklyGoalReached: boolean;
};

/**
 * Lichte context die de actieve Workout Mode bij paginalading meekrijgt zodat het
 * completion-scherm PR's/streak/weekdoel correct kan tonen — onafhankelijk van
 * wanneer sets tijdens de sessie worden opgeslagen. Live volume/sets/reps berekent
 * de client zelf uit de optimistische staat.
 */
export async function getWorkoutContext(
  sessionId: string,
  memberId: string,
  tenantId: string
): Promise<WorkoutContext> {
  const sessions = await loadMemberSessions(memberId, tenantId);

  const historicalBest: Record<string, number> = {};
  for (const s of sessions) {
    if (s.id === sessionId) continue;
    for (const e of s.performanceEntries) {
      if (e.weightKg <= 0) continue;
      const oneRm = epley(e.weightKg, e.reps);
      historicalBest[e.exerciseId] = Math.max(historicalBest[e.exerciseId] ?? 0, oneRm);
    }
  }

  const now = new Date();
  const weekStart = startOfWeek(now).getTime();
  const weekKeys = new Set<number>();
  let completedThisWeek = 0;
  for (const s of sessions) {
    if (s.endedAt == null) continue;
    weekKeys.add(startOfWeek(s.startedAt).getTime());
    if (s.startedAt.getTime() >= weekStart) completedThisWeek += 1;
  }
  // Tel de lopende sessie mee voor de huidige week.
  weekKeys.add(weekStart);
  const { current: projectedStreakWeeks } = computeStreaks(weekKeys, weekStart);
  const workoutsThisWeekIncl = completedThisWeek + 1;

  return {
    historicalBest,
    projectedStreakWeeks,
    weeklyGoal: MEMBER_WEEKLY_GOAL,
    workoutsThisWeekIncl,
    weeklyGoalReached: workoutsThisWeekIncl >= MEMBER_WEEKLY_GOAL,
  };
}

export type SessionSummary = {
  durationSec: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  exerciseCount: number;
  /** Oefeningen waarin in déze sessie een nieuwe PR is gezet. */
  newRecords: { name: string; weightKg: number; reps: number }[];
  /** Streak (weken) inclusief deze sessie. */
  streakWeeks: number;
  /** Of dit het weekdoel haalt of overtreft. */
  weeklyGoalReached: boolean;
  workoutsThisWeek: number;
  weeklyGoal: number;
};

/**
 * Samenvatting van één (zojuist afgeronde) sessie voor het completion-scherm.
 * PR-detectie vergelijkt het maximum van déze sessie met de historische beste
 * uit álle andere sessies van het lid.
 */
export async function getSessionSummary(
  sessionId: string,
  memberId: string,
  tenantId: string
): Promise<SessionSummary> {
  const sessions = await loadMemberSessions(memberId, tenantId);
  const target = sessions.find((s) => s.id === sessionId);

  // Historische beste 1RM per oefening, exclusief de doelsessie.
  const prevBest = new Map<string, number>();
  for (const s of sessions) {
    if (s.id === sessionId) continue;
    for (const e of s.performanceEntries) {
      if (e.weightKg <= 0) continue;
      const oneRm = epley(e.weightKg, e.reps);
      prevBest.set(e.exerciseId, Math.max(prevBest.get(e.exerciseId) ?? 0, oneRm));
    }
  }

  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  const exercises = new Set<string>();
  // Beste set van déze sessie per oefening (voor PR-melding).
  const sessionBest = new Map<string, { name: string; oneRm: number; weightKg: number; reps: number }>();

  for (const e of target?.performanceEntries ?? []) {
    totalSets += 1;
    totalReps += e.reps;
    totalVolume += e.reps * e.weightKg;
    exercises.add(e.exerciseId);
    if (e.weightKg > 0) {
      const oneRm = epley(e.weightKg, e.reps);
      const cur = sessionBest.get(e.exerciseId);
      if (!cur || oneRm > cur.oneRm) {
        sessionBest.set(e.exerciseId, { name: e.exercise.name, oneRm, weightKg: e.weightKg, reps: e.reps });
      }
    }
  }

  const newRecords = [...sessionBest.entries()]
    .filter(([id, best]) => best.oneRm > (prevBest.get(id) ?? 0))
    .map(([, best]) => ({ name: best.name, weightKg: best.weightKg, reps: best.reps }));

  const durationSec =
    target?.endedAt && target?.startedAt
      ? Math.max(0, Math.floor((target.endedAt.getTime() - target.startedAt.getTime()) / 1000))
      : target?.startedAt
        ? Math.max(0, Math.floor((Date.now() - target.startedAt.getTime()) / 1000))
        : 0;

  // Streak + weekdoel inclusief deze sessie.
  const now = new Date();
  const weekStart = startOfWeek(now).getTime();
  const weekKeys = new Set<number>();
  let workoutsThisWeek = 0;
  for (const s of sessions) {
    if (s.endedAt == null && s.id !== sessionId) continue;
    weekKeys.add(startOfWeek(s.startedAt).getTime());
    if (s.startedAt.getTime() >= weekStart) workoutsThisWeek += 1;
  }
  const { current: streakWeeks } = computeStreaks(weekKeys, weekStart);

  return {
    durationSec,
    totalSets,
    totalReps,
    totalVolume: Math.round(totalVolume),
    exerciseCount: exercises.size,
    newRecords,
    streakWeeks,
    weeklyGoalReached: workoutsThisWeek >= MEMBER_WEEKLY_GOAL,
    workoutsThisWeek,
    weeklyGoal: MEMBER_WEEKLY_GOAL,
  };
}
