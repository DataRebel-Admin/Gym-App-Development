// Herkomst van oefening-content — puur, géén `server-only` (badges renderen ook
// client-side in de schema-editor en pickers).
//
// Drie bronnen, afgeleid uit welke FK op de tenant-`Exercise` gevuld is:
//   "standaard" — LibraryExercise (RepDB, libraryId) — dé actuele bibliotheek
//   "klassiek"  — ExerciseCatalog (catalogId) — VEROUDERDE terugvaloptie,
//                 alleen vindbaar met feature-flag `exercise_legacy_catalog`
//   "eigen"     — geen van beide: door de tenant zelf gebouwde oefening

export type ExerciseSource = "standaard" | "eigen" | "klassiek";

export type ExerciseSourceMeta = {
  key: ExerciseSource;
  /** Kort NL-label voor de badge. */
  label: string;
  /** Badge-tint (Tailwind, statisch). */
  tone: string;
  /** Of de badge standaard getoond wordt (standaard-bron is impliciet → geen badge-ruis). */
  showBadge: boolean;
};

export const EXERCISE_SOURCE_META: Record<ExerciseSource, ExerciseSourceMeta> = {
  standaard: {
    key: "standaard",
    label: "Standaard",
    tone: "bg-neutral-100 text-neutral-600",
    showBadge: false,
  },
  eigen: {
    key: "eigen",
    label: "Eigen",
    tone: "bg-accent-soft text-accent",
    showBadge: true,
  },
  klassiek: {
    key: "klassiek",
    label: "Klassiek",
    tone: "bg-amber-50 text-amber-700",
    showBadge: true,
  },
};

/** Herkomst afleiden uit de FK's van een tenant-Exercise. */
export function exerciseSourceOf(ex: {
  libraryId?: string | null;
  catalogId?: string | null;
}): ExerciseSource {
  if (ex.libraryId) return "standaard";
  if (ex.catalogId) return "klassiek";
  return "eigen";
}
