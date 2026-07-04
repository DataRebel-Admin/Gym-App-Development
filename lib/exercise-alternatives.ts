import "server-only";
import { prisma } from "@/lib/db";
import { resolveRegion, type MuscleRegion } from "@/lib/muscle-map";

/**
 * Alternatieve-oefening-suggesties tijdens een actieve training (bv. als het
 * apparaat bezet is). Puur afgeleid uit bestaande data — géén nieuw model:
 * scoort tenant-oefeningen op overlap in **spiergroep** (via de heatmap-mapping),
 * **oefeningstype**, **lichaamsdeel** en **materiaal**. Geen medisch advies; de UI
 * toont altijd de "raadpleeg een professional"-melding.
 *
 * Data-afhankelijkheid: rijkere aanbevelingen naarmate oefeningen een
 * catalogus-koppeling (target/bodyPart/equipment/secondaryMuscles) of ingevulde
 * eigen-oefening-velden (targetMuscle/muscleGroups/category/equipment) hebben.
 * Ontbreekt dat volledig, dan valt het terug op oefeningstype (en anders leeg).
 */

export type AlternativeSuggestion = {
  exerciseId: string;
  name: string;
  machineName: string | null;
  thumbUrl: string | null;
  /** Waaróm dit een alternatief is (NL-label voor de UI). */
  reason: string;
};

type CandidateRow = {
  id: string;
  name: string;
  exerciseType: string;
  machineId: string | null;
  targetMuscle: string | null;
  muscleGroups: string[];
  equipment: string | null;
  machine: { name: string } | null;
  catalog: {
    target: string | null;
    muscleGroup: string | null;
    bodyPart: string | null;
    equipment: string | null;
    secondaryMuscles: string[];
    imageUrl: string | null;
    gifUrl: string | null;
  } | null;
};

const candidateSelect = {
  id: true,
  name: true,
  exerciseType: true,
  machineId: true,
  targetMuscle: true,
  muscleGroups: true,
  equipment: true,
  machine: { select: { name: true } },
  catalog: {
    select: {
      target: true,
      muscleGroup: true,
      bodyPart: true,
      equipment: true,
      secondaryMuscles: true,
      imageUrl: true,
      gifUrl: true,
    },
  },
} as const;

/** Primaire regio van een oefening (voor "zelfde spiergroep"-matching). */
function primaryRegion(ex: CandidateRow): MuscleRegion | null {
  return (
    resolveRegion(ex.catalog?.target) ??
    resolveRegion(ex.targetMuscle) ??
    resolveRegion(ex.catalog?.muscleGroup) ??
    resolveRegion(ex.muscleGroups[0]) ??
    null
  );
}

/** Alle geraakte regio's (primair + secundair) van een oefening. */
function allRegions(ex: CandidateRow): Set<MuscleRegion> {
  const out = new Set<MuscleRegion>();
  const raw = [
    ex.catalog?.target,
    ex.catalog?.muscleGroup,
    ex.targetMuscle,
    ...(ex.catalog?.secondaryMuscles ?? []),
    ...ex.muscleGroups,
  ];
  for (const r of raw) {
    const region = resolveRegion(r);
    if (region) out.add(region);
  }
  return out;
}

function equipmentOf(ex: CandidateRow): string | null {
  return (ex.catalog?.equipment ?? ex.equipment ?? null)?.toLowerCase() ?? null;
}

/**
 * Vind maximaal `take` alternatieven voor `exerciseId` binnen dezelfde tenant.
 * `excludeIds` sluit oefeningen uit die al in de sessie zitten. Retourneert een
 * lege lijst als er geen zinnige match is (→ nette lege staat in de UI).
 */
export async function findAlternatives(
  tenantId: string,
  exerciseId: string,
  excludeIds: string[] = [],
  take = 8
): Promise<AlternativeSuggestion[]> {
  const source = await prisma.exercise.findFirst({
    where: { id: exerciseId, tenantId },
    select: candidateSelect,
  });
  if (!source) return [];

  const skip = new Set([exerciseId, ...excludeIds]);
  const candidates = await prisma.exercise.findMany({
    where: { tenantId, archivedAt: null, id: { notIn: [...skip] } },
    select: candidateSelect,
  });

  const srcPrimary = primaryRegion(source);
  const srcRegions = allRegions(source);
  const srcBodyPart = source.catalog?.bodyPart?.toLowerCase() ?? null;
  const srcEquip = equipmentOf(source);

  type Scored = AlternativeSuggestion & { score: number; regionMatch: boolean };
  const scored: Scored[] = [];

  for (const c of candidates) {
    let score = 0;
    let reason = "";

    const cPrimary = primaryRegion(c);
    const cRegions = allRegions(c);
    const sharesRegion = [...cRegions].some((r) => srcRegions.has(r));

    if (srcPrimary && cPrimary === srcPrimary) {
      score += 5;
      reason = "Zelfde spiergroep";
    } else if (sharesRegion) {
      score += 3;
      reason = reason || "Overlappende spiergroep";
    }

    if (c.exerciseType === source.exerciseType) {
      score += 2;
      reason = reason || "Zelfde type oefening";
    }

    if (srcBodyPart && c.catalog?.bodyPart?.toLowerCase() === srcBodyPart) {
      score += 2;
      reason = reason || "Zelfde lichaamsdeel";
    }

    if (srcEquip && equipmentOf(c) === srcEquip) score += 1;

    // Apparaat bezet → geef een ander apparaat een lichte voorkeur.
    if ((c.machineId ?? null) !== (source.machineId ?? null)) score += 1;

    if (score <= 0 || !reason) continue;

    scored.push({
      exerciseId: c.id,
      name: c.name,
      machineName: c.machine?.name ?? null,
      thumbUrl: c.catalog?.imageUrl ?? c.catalog?.gifUrl ?? null,
      reason,
      score,
      regionMatch: sharesRegion,
    });
  }

  // Sorteer op relevantie; bij gelijke score de spiergroep-matches eerst.
  scored.sort((a, b) => b.score - a.score || Number(b.regionMatch) - Number(a.regionMatch));

  return scored.slice(0, take).map(({ exerciseId, name, machineName, thumbUrl, reason }) => ({
    exerciseId,
    name,
    machineName,
    thumbUrl,
    reason,
  }));
}
