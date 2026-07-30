// Mappings van RepDB-waardes naar onze registries — puur, géén `server-only`
// (idioom lib/exercise-types.ts): gedeeld door het import-script, de resolver
// en de UI. Eén bron van waarheid zodat import en runtime nooit uiteenlopen.

/**
 * Leid het oefeningstype (registry lib/exercise-types.ts) af uit de
 * RepDB-metadata. Volgorde is bewust van specifiek → generiek; de owner kan
 * per oefening bijsturen via de bestaande ExerciseTypeSelect.
 */
export function inferLibraryExerciseType(ex: {
  category: string;
  forceType?: string | null;
  bodyPart?: string | null;
  goals?: string[];
}): string {
  const goals = ex.goals ?? [];
  if (ex.category === "cardio") return "cardio";
  if (ex.category === "stretching") return goals.includes("mobility") ? "mobility" : "stretch";
  if (ex.forceType === "static") return "isometric";
  if (ex.bodyPart === "core") return "core";
  if (ex.category === "plyometrics") return "functional";
  return "strength";
}

/**
 * MachineType-suggestie op basis van het RepDB-materiaal (slug + tags uit
 * LibraryEquipment). Tag-gedreven — de tags zijn dataset-onderhouden en
 * stabieler dan naam-heuristiek (vgl. suggestMachineType voor de legacy-set).
 */
export function machineTypeFromLibrary(
  equipmentSlug: string | null | undefined,
  equipmentTags: string[] | null | undefined
): "CARDIO" | "KRACHT" | "VRIJE_GEWICHTEN" | "OVERIG" {
  if (!equipmentSlug) return "OVERIG"; // lichaamsgewicht / geen materiaal
  const tags = equipmentTags ?? [];
  if (tags.includes("cardio_machine")) return "CARDIO";
  if (tags.includes("machine") || equipmentSlug === "cable") return "KRACHT";
  if (tags.includes("free_weight")) return "VRIJE_GEWICHTEN";
  return "OVERIG"; // conditioning tools, banden, bodyweight aids, …
}

/** RepDB-difficulty → onze ExerciseDifficulty-enum (string-literals, client-safe). */
export function difficultyFromLibrary(
  difficulty: string | null | undefined
): "BEGINNER" | "GEMIDDELD" | "GEVORDERD" | null {
  switch (difficulty) {
    case "beginner":
      return "BEGINNER";
    case "intermediate":
      return "GEMIDDELD";
    case "advanced":
      return "GEVORDERD";
    default:
      return null;
  }
}

/**
 * Taalvoorkeur voor bibliotheek-teksten per UI-taal (lib/i18n/config.ts).
 * Kleine-letters ISO-codes zoals in LibraryExerciseText.locale. NL-teksten
 * bestaan pas na de (latere) vertaalronde — tot die tijd valt nl terug op en.
 */
export function datasetLocalePreference(uiLocale: string): string[] {
  switch (uiLocale.toLowerCase()) {
    case "nl":
      return ["nl", "en"];
    case "fy":
      return ["nl", "en"]; // Frysk: geen dataset-taal, dichtst bij nl
    case "de":
      return ["de", "en"];
    case "es":
      return ["es", "en"];
    default:
      return ["en"];
  }
}

/** Kies de eerste beschikbare tekst-rij volgens de taalvoorkeur. */
export function pickLibraryText<T extends { locale: string }>(
  texts: T[],
  preference: string[]
): T | null {
  for (const locale of preference) {
    const hit = texts.find((t) => t.locale === locale);
    if (hit) return hit;
  }
  return texts.find((t) => t.locale === "en") ?? texts[0] ?? null;
}

/**
 * RepDB-trainingsdoel → key uit lib/training-goals.ts (voor de template-import
 * en filter-badges). Onbekend doel → null (geen tag).
 */
export function trainingGoalFromLibrary(goal: string | null | undefined): string | null {
  switch (goal) {
    case "strength":
      return "strength";
    case "hypertrophy":
      return "muscle";
    case "endurance":
      return "conditioning";
    case "mobility":
      return "mobility";
    case "core":
      return "stability";
    case "rehabilitation":
      return "rehab";
    case "power":
      return "sport";
    default:
      return null;
  }
}

/** Weergavenamen (NL) voor de RepDB-enums — UI hardcoded NL (precedent muscles/maintenance). */
export const LIBRARY_BODY_PART_LABEL: Record<string, string> = {
  back: "Rug",
  chest: "Borst",
  core: "Core",
  full_body: "Hele lichaam",
  lower_arms: "Onderarmen",
  lower_legs: "Onderbenen",
  shoulders: "Schouders",
  upper_arms: "Bovenarmen",
  upper_legs: "Bovenbenen",
};

/**
 * Lichaamsdeel-waardes van de VEROUDERDE catalogus → hetzelfde NL-label. De oude
 * dataset gebruikt eigen termen ("waist" = buik/core, "cardio" is geen lichaamsdeel).
 * Waardes met een spatie ("upper legs") worden al door {@link bodyPartLabel}
 * genormaliseerd naar de bibliotheek-sleutel.
 */
const LEGACY_BODY_PART_LABEL: Record<string, string> = {
  waist: "Core", // valt bewust samen met bibliotheek-`core` → één filterchip
  cardio: "Cardio",
  neck: "Nek",
};

/**
 * Canoniek NL-label voor een lichaamsdeel, bron-onafhankelijk: bibliotheek-sleutels
 * (`upper_legs`) én klassieke catalogus-waardes (`upper legs`) leveren hetzelfde
 * label. Nodig omdat een oefeningenlijst beide bronnen mengt — anders staat
 * "upper legs" náást "Bovenbenen" (of ontbreekt de chip helemaal).
 */
export function bodyPartLabel(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
  return LIBRARY_BODY_PART_LABEL[key] ?? LEGACY_BODY_PART_LABEL[key] ?? trimmed;
}

export const LIBRARY_CATEGORY_LABEL: Record<string, string> = {
  cardio: "Cardio",
  olympic: "Olympisch",
  plyometrics: "Plyometrie",
  strength: "Kracht",
  stretching: "Stretching",
  strongman: "Strongman",
};

export const LIBRARY_DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Gemiddeld",
  advanced: "Gevorderd",
};

export const LIBRARY_GOAL_LABEL: Record<string, string> = {
  strength: "Kracht",
  hypertrophy: "Spieropbouw",
  endurance: "Uithouding",
  mobility: "Mobiliteit",
  power: "Explosiviteit",
  rehabilitation: "Revalidatie",
  core: "Core",
};

/**
 * Vertaal de vrije reps-notatie van een RepDB-voorbeeldschema ("5", "8-12",
 * "AMRAP", "30s", "10/leg") naar onze integer-kolom + een notitie voor de rest.
 * Regel: leidend getal → reps-kolom; alles wat informatie verliest gaat als
 * notitie mee (het item blijft daardoor volledig leesbaar voor het lid).
 */
export function parseTemplateReps(reps: string): { reps: number | null; note: string | null } {
  const trimmed = reps.trim();
  const range = /^(\d+)\s*-\s*(\d+)$/.exec(trimmed);
  if (range) return { reps: Number(range[1]), note: `${range[1]}–${range[2]} herhalingen` };
  if (/^\d+$/.test(trimmed)) return { reps: Number(trimmed), note: null };
  const leading = /^(\d+)/.exec(trimmed);
  if (leading) return { reps: Number(leading[1]), note: trimmed };
  return { reps: null, note: trimmed }; // bv. "AMRAP"
}

/** Naam uit een {locale: naam}-Json (LibraryMuscle/LibraryEquipment.names). */
export function pickJsonName(
  names: unknown,
  preference: string[]
): string | null {
  if (!names || typeof names !== "object" || Array.isArray(names)) return null;
  const map = names as Record<string, unknown>;
  for (const locale of [...preference, "en"]) {
    const v = map[locale];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
}
