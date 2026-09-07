import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import {
  MUSCLE_REGIONS,
  MUSCLE_REGION_ORDER,
  accumulateMuscleVolume,
  levelForWeeklySets,
  type BodyView,
  type MuscleLevel,
  type MuscleRegion,
} from "@/lib/muscle-map";
import {
  accumulateHeatmapVolume,
  primaryHeatmapMuscles,
  secondaryHeatmapMuscles,
} from "@/lib/muscle-heatmap";
import { targetSummaryFromItem } from "@/lib/exercise-params";

/**
 * Spier-analyse van het actieve schema van een lid.
 *
 * - **Plan**: wekelijks set-volume per spierregio, afgeleid uit het toegewezen
 *   schema (aanname: de sporter loopt het volledige schema één keer per week door).
 * - **Echt getraind**: set-volume per regio uit de laatste 28 dagen
 *   (`PerformanceEntry`), teruggerekend naar een weekgemiddelde (÷4).
 *
 * De primaire spier(en) tellen vol mee; secundaire spieren tellen half (0.5) —
 * een gangbare weging. Tenant-scoped via expliciete `tenantId` (zoals
 * lib/member-stats.ts).
 *
 * De telregel zelf (bron-bewust, primair vol / secundair half) is puur en getest:
 * `accumulateMuscleVolume` in lib/muscle-map.ts.
 */

/** Selectie van spier-relevante velden op een oefening (bibliotheek + catalogus + eigen). */
const exerciseMuscleSelect = {
  targetMuscle: true,
  muscleGroups: true,
  catalog: {
    select: { target: true, muscleGroup: true, secondaryMuscles: true },
  },
  library: {
    select: { primaryMuscles: true, secondaryMuscles: true },
  },
} as const;

export type RegionAnalysis = {
  region: MuscleRegion;
  label: string;
  views: BodyView[];
  /** Wekelijks set-volume uit het schema (afgerond op 0.5). */
  planWeekly: number;
  /** Wekelijks set-volume echt getraind (laatste 28 dagen ÷4, afgerond op 0.5). */
  actualWeekly: number;
  /** Heatmap-niveau (0..5), gebaseerd op het plan-volume. */
  level: MuscleLevel;
};

export type MuscleAnalysis = {
  hasSchema: boolean;
  schemaName: string | null;
  daysCount: number;
  /** Of er trainingsactiviteit in de laatste 28 dagen is. */
  hasActual: boolean;
  /** Alle 16 regio's in vaste volgorde. */
  regions: RegionAnalysis[];
  /** Snelle lookup voor de SVG-kleuring. */
  levelByRegion: Record<MuscleRegion, MuscleLevel>;
  /** Meest belaste regio's (plan), aflopend. */
  topRegions: { region: MuscleRegion; label: string; planWeekly: number }[];
  /** Trainbare regio's die het schema níét raakt (plan = 0). */
  neglected: { region: MuscleRegion; label: string }[];
};

function round05(n: number): number {
  return Math.round(n * 2) / 2;
}

/**
 * Gecachet per (tenant, lid) met 5-min revalidatie — de spier-analyse is een
 * 4-weken-trend, dus lichte staleness is onmerkbaar (één sessie verschuift het
 * weekgemiddelde nauwelijks). Idioom van lib/insights.ts (getDashboardStats).
 */
export function getMuscleAnalysis(memberId: string, tenantId: string): Promise<MuscleAnalysis> {
  return unstable_cache(
    () => computeMuscleAnalysis(memberId, tenantId),
    ["muscle-analysis", tenantId, memberId],
    { revalidate: 300 }
  )();
}

/** Bouw de analyse voor het actieve schema van een lid. */
async function computeMuscleAnalysis(
  memberId: string,
  tenantId: string
): Promise<MuscleAnalysis> {
  const now = new Date();

  const [assignment, entries] = await Promise.all([
    prisma.assignedWorkout.findFirst({
      where: {
        tenantId,
        userId: memberId,
        status: "PUBLISHED",
        OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        template: {
          select: {
            name: true,
            days: { select: { id: true } },
            items: {
              select: { sets: true, exercise: { select: exerciseMuscleSelect } },
            },
          },
        },
      },
    }),
    prisma.performanceEntry.findMany({
      where: {
        tenantId,
        session: { userId: memberId, startedAt: { gte: new Date(now.getTime() - 28 * 86400_000) } },
      },
      select: { exercise: { select: exerciseMuscleSelect } },
    }),
  ]);

  const template = assignment?.template ?? null;

  // Plan: som van sets over alle items (aanname: schema 1×/week).
  const plan = new Map<MuscleRegion, number>();
  for (const it of template?.items ?? []) {
    accumulateMuscleVolume(plan, it.exercise, it.sets);
  }

  // Echt getraind: elke PerformanceEntry = één set, over 28 dagen → ÷4 = week.
  const actual = new Map<MuscleRegion, number>();
  for (const e of entries) {
    accumulateMuscleVolume(actual, e.exercise, 1);
  }

  const regions: RegionAnalysis[] = MUSCLE_REGION_ORDER.map((region) => {
    const planWeekly = round05(plan.get(region) ?? 0);
    const actualWeekly = round05((actual.get(region) ?? 0) / 4);
    return {
      region,
      label: MUSCLE_REGIONS[region].label,
      views: MUSCLE_REGIONS[region].views,
      planWeekly,
      actualWeekly,
      level: levelForWeeklySets(planWeekly),
    };
  });

  const levelByRegion = Object.fromEntries(
    regions.map((r) => [r.region, r.level])
  ) as Record<MuscleRegion, MuscleLevel>;

  const topRegions = regions
    .filter((r) => r.planWeekly > 0)
    .sort((a, b) => b.planWeekly - a.planWeekly)
    .slice(0, 3)
    .map((r) => ({ region: r.region, label: r.label, planWeekly: r.planWeekly }));

  const neglected = regions
    .filter((r) => r.planWeekly === 0)
    .map((r) => ({ region: r.region, label: r.label }));

  return {
    hasSchema: template != null,
    schemaName: template?.name ?? null,
    daysCount: template?.days.length ?? 0,
    hasActual: entries.length > 0,
    regions,
    levelByRegion,
    topRegions,
    neglected,
  };
}

// --- Anatomische heatmap: volume + oefeningen per overlay-spier, per dag ----
//
// Voedt components/muscle/anatomical-heatmap.tsx: het figuur kleurt per
// overlay-spier (RepDB muscle_heatmap-assets, zie lib/muscle-heatmap.ts) en
// het detailpaneel toont per aangetikte spier de bijdragende oefeningen met
// hun doel-samenvatting ("4 × 10 @ 70 kg"). Naast het weektotaal is er per
// trainingsdag een eigen volume-verdeling — zo ziet het lid waar de nadruk
// van elke dag ligt.

export type HeatmapExerciseRow = {
  name: string;
  /** Doel-samenvatting via de centrale helper (targetSummaryFromItem). */
  summary: string;
  dayId: string;
  dayName: string;
  /** Overlay-spieren die deze oefening primair (vol) belast. */
  primary: string[];
  /** Overlay-spieren die secundair (half) meedoen. */
  secondary: string[];
};

export type ScheduleHeatmap = {
  hasSchema: boolean;
  schemaName: string | null;
  days: { id: string; name: string }[];
  /** Scope "week" + elke dag-id → set-volume per overlay-spier (op 0.5 afgerond). */
  volumes: Record<string, Record<string, number>>;
  exercises: HeatmapExerciseRow[];
};

/** Gecachet zoals getMuscleAnalysis (zelfde staleness-afweging, 5 min). */
export function getScheduleHeatmap(
  memberId: string,
  tenantId: string
): Promise<ScheduleHeatmap> {
  return unstable_cache(
    () => computeScheduleHeatmap(memberId, tenantId),
    ["muscle-heatmap", tenantId, memberId],
    { revalidate: 300 }
  )();
}

async function computeScheduleHeatmap(
  memberId: string,
  tenantId: string
): Promise<ScheduleHeatmap> {
  const now = new Date();
  // Zelfde actief-schema-selectie als computeMuscleAnalysis hierboven.
  const assignment = await prisma.assignedWorkout.findFirst({
    where: {
      tenantId,
      userId: memberId,
      status: "PUBLISHED",
      OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      template: {
        select: {
          name: true,
          days: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              name: true,
              items: {
                orderBy: { order: "asc" },
                select: {
                  sets: true,
                  reps: true,
                  restSeconds: true,
                  weightKg: true,
                  tempo: true,
                  params: true,
                  exercise: {
                    select: { name: true, exerciseType: true, ...exerciseMuscleSelect },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const template = assignment?.template ?? null;
  if (!template) {
    return { hasSchema: false, schemaName: null, days: [], volumes: {}, exercises: [] };
  }

  const week = new Map<string, number>();
  const volumes: Record<string, Record<string, number>> = {};
  const exercises: HeatmapExerciseRow[] = [];

  for (const day of template.days) {
    const dayAcc = new Map<string, number>();
    for (const it of day.items) {
      accumulateHeatmapVolume(dayAcc, it.exercise, it.sets);
      accumulateHeatmapVolume(week, it.exercise, it.sets);
      exercises.push({
        name: it.exercise.name,
        summary: targetSummaryFromItem(it, it.exercise.exerciseType),
        dayId: day.id,
        dayName: day.name,
        primary: primaryHeatmapMuscles(it.exercise),
        secondary: secondaryHeatmapMuscles(it.exercise),
      });
    }
    volumes[day.id] = roundVolumeMap(dayAcc);
  }
  volumes.week = roundVolumeMap(week);

  return {
    hasSchema: true,
    schemaName: template.name,
    days: template.days.map((d) => ({ id: d.id, name: d.name })),
    volumes,
    exercises,
  };
}

function roundVolumeMap(acc: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...acc.entries()].map(([k, v]) => [k, round05(v)]));
}
