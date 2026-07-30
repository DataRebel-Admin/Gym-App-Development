// Herkomst van oefening-content — puur, géén `server-only` (badges renderen ook
// client-side in de schema-editor en pickers).
//
// Drie bronnen, afgeleid uit welke FK op de tenant-`Exercise` gevuld is:
//   "standaard" — LibraryExercise (RepDB, libraryId) — dé actuele bibliotheek
//   "klassiek"  — ExerciseCatalog (catalogId) — de oudere collectie, naar de
//                 gebruiker toe "Aanvullend": ze worden nog gebruikt, dus geen
//                 afstotelijk "verouderd"-label. Nieuwe toevoegingen zijn wel
//                 gegate op feature-flag `exercise_legacy_catalog`.
//                 (De sleutel blijft `klassiek` — interne naam, niet zichtbaar.)
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
    label: "Aanvullend",
    tone: "bg-sky-50 text-sky-700",
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

/**
 * Prisma-`where`-fragment voor "echt eigen" oefeningen — de query-tegenhanger van
 * `exerciseSourceOf(...) === "eigen"`: BEIDE bron-FK's moeten NULL zijn.
 *
 * Gebruik dit overal waar eigen-oefeningbeheer gescoped wordt (lijst, bewerken,
 * dupliceren, archiveren, verwijderen). `catalogId: null` alléén is sinds
 * `libraryId` bestaat NIET genoeg — dan lekt de hele bibliotheek de Eigen-tab in
 * en kunnen bibliotheek-oefeningen via het eigen-formulier gemuteerd worden.
 */
export const OWN_EXERCISE_WHERE = { catalogId: null, libraryId: null } as const;
