import "server-only";
import { prisma } from "@/lib/db";
import {
  MUSCLE_REGIONS,
  MUSCLE_REGION_ORDER,
  levelForWeeklySets,
  resolveRegion,
  type BodyView,
  type MuscleLevel,
  type MuscleRegion,
} from "@/lib/muscle-map";

/**
 * Spier-analyse van het actieve schema van een lid.
 *
 * - **Plan**: wekelijks set-volume per spierregio, afgeleid uit het toegewezen
 *   schema (aanname: de sporter loopt het volledige schema één keer per week door).
 * - **Echt getraind**: set-volume per regio uit de laatste 28 dagen
 *   (`PerformanceEntry`), teruggerekend naar een weekgemiddelde (÷4).
 *
 * De primaire spier (`target`/`targetMuscle`) telt vol mee; secundaire spieren
 * (`secondaryMuscles`/`muscleGroups`) tellen half (0.5) — een gangbare weging.
 * Tenant-scoped via expliciete `tenantId` (zoals lib/member-stats.ts).
 */

/** Selectie van spier-relevante velden op een oefening (catalogus + eigen). */
const exerciseMuscleSelect = {
  targetMuscle: true,
  muscleGroups: true,
  catalog: {
    select: { target: true, muscleGroup: true, secondaryMuscles: true },
  },
} as const;

type ExerciseMuscleInfo = {
  targetMuscle: string | null;
  muscleGroups: string[];
  catalog: {
    target: string | null;
    muscleGroup: string | null;
    secondaryMuscles: string[];
  } | null;
};

/** Primaire spier van een oefening (eigen `targetMuscle` wint van catalogus). */
function primaryRaw(ex: ExerciseMuscleInfo): string | null {
  return ex.targetMuscle ?? ex.catalog?.target ?? ex.catalog?.muscleGroup ?? null;
}

/** Secundaire spieren van een oefening (catalogus + eigen extra spiergroepen). */
function secondaryRaws(ex: ExerciseMuscleInfo): string[] {
  return [...(ex.catalog?.secondaryMuscles ?? []), ...(ex.muscleGroups ?? [])];
}

/**
 * Verdeel `sets` van één oefening over de spierregio's: primair vol, secundair
 * half. Muteert `acc` in-place.
 */
function accumulate(
  acc: Map<MuscleRegion, number>,
  ex: ExerciseMuscleInfo,
  sets: number
) {
  const primary = resolveRegion(primaryRaw(ex));
  if (primary) acc.set(primary, (acc.get(primary) ?? 0) + sets);

  const seen = new Set<MuscleRegion>(primary ? [primary] : []);
  for (const raw of secondaryRaws(ex)) {
    const region = resolveRegion(raw);
    if (!region || seen.has(region)) continue; // niet dubbel tellen per oefening
    seen.add(region);
    acc.set(region, (acc.get(region) ?? 0) + sets * 0.5);
  }
}

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

/** Bouw de analyse voor het actieve schema van een lid. */
export async function getMuscleAnalysis(
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
    accumulate(plan, it.exercise, it.sets);
  }

  // Echt getraind: elke PerformanceEntry = één set, over 28 dagen → ÷4 = week.
  const actual = new Map<MuscleRegion, number>();
  for (const e of entries) {
    accumulate(actual, e.exercise, 1);
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
