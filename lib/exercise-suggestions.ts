// Alternatieven-suggesties voor de schema-pickers — puur, géén `server-only`
// (idioom lib/exercise-thumb.ts / lib/muscle-map.ts): beide editors (owner-
// SchemaEditor + mobiele lid-builder) hebben de volledige tenant-oefeningenlijst
// al in het geheugen, dus suggesties kosten geen extra server-roundtrip.
//
// De scoring spiegelt bewust `findAlternatives` (lib/exercise-alternatives.ts,
// het "apparaat bezet"-pad in de actieve sessie): zelfde primaire spiergroep
// weegt het zwaarst, dan spier-overlap, dan zelfde oefeningstype/lichaamsdeel.
// Ander materiaal telt licht mee — een alternatief op ánder materiaal is in een
// schema juist nuttig (variatie / drukte bij het apparaat).

import { resolveRegion } from "@/lib/muscle-map";

export type SuggestibleExercise = {
  id: string;
  name: string;
  exerciseType: string;
  /** Rauwe spier-labels/slugs (bibliotheek-slugs, catalogus- of eigen labels). */
  muscles: string[];
  secondaryMuscles: string[];
  bodyPart: string | null;
  equipment: string | null;
};

export type PickerSuggestion<T> = { exercise: T; reason: string };

function regionsOf(raws: string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of raws) {
    const region = resolveRegion(raw);
    if (region) out.add(region);
  }
  return out;
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const v of a) if (b.has(v)) return true;
  return false;
}

/**
 * Beste alternatieven voor `forExercise` uit de al geladen lijst. Oefeningen in
 * `excludeIds` (bv. alles wat al in de dag staat) vallen af; zonder zinnige
 * match (score 0) komt er gewoon niets — de UI toont dan geen strook.
 */
export function suggestAlternatives<T extends SuggestibleExercise>(
  all: readonly T[],
  forExercise: SuggestibleExercise,
  excludeIds: Iterable<string>,
  take = 4
): PickerSuggestion<T>[] {
  const exclude = new Set(excludeIds);
  exclude.add(forExercise.id);

  const srcPrimary = regionsOf(forExercise.muscles);
  const srcAll = new Set([...srcPrimary, ...regionsOf(forExercise.secondaryMuscles)]);

  const scored: { exercise: T; reason: string; score: number; primary: boolean }[] = [];
  for (const cand of all) {
    if (exclude.has(cand.id)) continue;
    const candPrimary = regionsOf(cand.muscles);
    const candAll = new Set([...candPrimary, ...regionsOf(cand.secondaryMuscles)]);

    let score = 0;
    let reason: string | null = null;
    const primaryMatch = srcPrimary.size > 0 && overlaps(candPrimary, srcPrimary);
    if (primaryMatch) {
      score += 5;
      reason = "Zelfde spiergroep";
    } else if (srcAll.size > 0 && overlaps(candAll, srcAll)) {
      score += 3;
      reason = "Traint dezelfde spieren";
    }
    if (cand.exerciseType === forExercise.exerciseType) score += 2;
    if (cand.bodyPart && forExercise.bodyPart && cand.bodyPart === forExercise.bodyPart) {
      score += 2;
      reason ??= "Zelfde lichaamsdeel";
    }
    // Ander materiaal = lichte plus: echte variatie i.p.v. bijna dezelfde oefening.
    if (cand.equipment && forExercise.equipment && cand.equipment !== forExercise.equipment) {
      score += 1;
    }
    if (score <= 0 || !reason) continue;
    scored.push({ exercise: cand, reason, score, primary: primaryMatch });
  }

  scored.sort((a, b) => b.score - a.score || Number(b.primary) - Number(a.primary));
  return scored.slice(0, take).map(({ exercise, reason }) => ({ exercise, reason }));
}
