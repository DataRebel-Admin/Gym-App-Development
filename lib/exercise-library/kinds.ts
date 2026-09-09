import { disciplineTerms } from "@/lib/exercise-library/search-text";

/**
 * Grove "soort"-indeling van een oefening voor de filterchips in de
 * ledenbibliotheek (/member/exercises). Puur, ook client — idioom
 * exercise-types.ts.
 *
 * Bewust grover dan `EXERCISE_TYPES`: een lid filtert op "yoga" of
 * "stretchen", niet op "isometrisch". Een oefening kan meerdere soorten
 * dragen (een yoga-houding is óók stretching).
 *
 * - `strength`/`cardio`/`core`/`stretch` volgen `Exercise.exerciseType`
 *   (TYPE_TO_KIND). RepDB's categorie "stretching" telt ook als stretch: bij
 *   import wordt die categorie meestal `mobility`, en een door de eigenaar
 *   omgezet type mag de rek-oefening niet uit de chip laten vallen.
 * - `yoga`/`pilates` zijn afgeleid uit naam + synoniemen (`disciplineTerms`):
 *   RepDB labelt die disciplines nergens.
 */
export type ExerciseKind = "strength" | "cardio" | "core" | "stretch" | "yoga" | "pilates";

/** Vaste chip-volgorde. */
export const EXERCISE_KIND_ORDER: readonly ExerciseKind[] = [
  "strength",
  "cardio",
  "core",
  "stretch",
  "yoga",
  "pilates",
];

/**
 * Engelse zoekwoorden per soort, zodat de vrije zoekbalk hetzelfde vindt als
 * de chip: wie "yoga" of "stretching" typt krijgt dezelfde set als wie de chip
 * aantikt. Bewust **alleen Engels** — Nederlandse invoer landt hier via de
 * query-expansie in `search-text.ts` ("rekken" → "stretching", "kracht" →
 * "strength", "buikspieren" → "abs"), zodat het glossarium de enige plek
 * blijft waar Nederlands staat.
 */
export const KIND_SEARCH_TERMS: Record<ExerciseKind, string[]> = {
  strength: ["strength"],
  cardio: ["cardio", "endurance"],
  core: ["core", "abs"],
  stretch: ["stretch", "stretching", "mobility"],
  yoga: ["yoga"],
  pilates: ["pilates"],
};

const TYPE_TO_KIND: Record<string, ExerciseKind> = {
  strength: "strength",
  isometric: "strength",
  functional: "strength",
  circuit: "strength",
  hiit: "strength",
  cardio: "cardio",
  endurance: "cardio",
  core: "core",
  stretch: "stretch",
  mobility: "stretch",
};

export function exerciseKinds(ex: {
  exerciseType: string;
  /** RepDB-categorie (`LibraryExercise.category`), null bij klassiek/eigen. */
  libraryCategory?: string | null;
  /** Slug, naam en synoniemen — bron voor de discipline-afleiding. */
  names: string[];
}): ExerciseKind[] {
  const out = new Set<ExerciseKind>();
  const byType = TYPE_TO_KIND[ex.exerciseType];
  if (byType) out.add(byType);
  if (ex.libraryCategory === "stretching") out.add("stretch");
  for (const d of disciplineTerms(ex.names)) {
    if (d === "yoga" || d === "pilates") out.add(d);
  }
  return EXERCISE_KIND_ORDER.filter((k) => out.has(k));
}
