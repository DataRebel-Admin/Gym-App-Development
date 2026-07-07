// Spiergroep-mapping — één bron van waarheid voor de spier-heatmap & -analyse.
//
// Bewust GEEN `server-only`: dit wordt zowel server-side (aggregatie in
// lib/muscle-analysis.ts) als client-side (body-heatmap, radar) gebruikt — net
// als lib/exercise-types.ts en lib/rbac.ts.
//
// De externe oefeningen-catalogus levert ruwe spier-labels (`target`,
// `muscleGroup`, `secondaryMuscles`); eigen oefeningen leveren `targetMuscle` +
// `muscleGroups`. Al die vrije strings worden hier genormaliseerd naar een vaste
// set anatomische regio's die we op de body-SVG tekenen.

/** Canonieke spierregio's die op de body-SVG (voor/achter) getekend worden. */
export type MuscleRegion =
  | "chest"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "obliques"
  | "traps"
  | "lats"
  | "upperBack"
  | "lowerBack"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "adductors"
  | "calves";

export type BodyView = "front" | "back";

export type MuscleRegionMeta = {
  region: MuscleRegion;
  /** Nette NL-naam voor labels/tooltips/radar-assen. */
  label: string;
  /** Op welke aanzicht(en) de regio zichtbaar is. */
  views: BodyView[];
};

/** Metadata per regio (label + op welk aanzicht het hoort). Volgorde = radar-volgorde. */
export const MUSCLE_REGIONS: Record<MuscleRegion, MuscleRegionMeta> = {
  chest: { region: "chest", label: "Borst", views: ["front"] },
  shoulders: { region: "shoulders", label: "Schouders", views: ["front", "back"] },
  biceps: { region: "biceps", label: "Biceps", views: ["front"] },
  triceps: { region: "triceps", label: "Triceps", views: ["back"] },
  forearms: { region: "forearms", label: "Onderarmen", views: ["front", "back"] },
  abs: { region: "abs", label: "Buik", views: ["front"] },
  obliques: { region: "obliques", label: "Schuine buik", views: ["front"] },
  // De gevendorde body-dataset heeft geen aparte trapezius-polygoon aan de
  // voorkant (alleen in POSTERIOR) → de spier is enkel via het achteraanzicht
  // benaderbaar op de heatmap. Vgl. de lats-kanttekening.
  traps: { region: "traps", label: "Trapezius", views: ["back"] },
  lats: { region: "lats", label: "Lats", views: ["back"] },
  upperBack: { region: "upperBack", label: "Bovenrug", views: ["back"] },
  lowerBack: { region: "lowerBack", label: "Onderrug", views: ["back"] },
  glutes: { region: "glutes", label: "Bilspieren", views: ["back"] },
  quads: { region: "quads", label: "Quadriceps", views: ["front"] },
  hamstrings: { region: "hamstrings", label: "Hamstrings", views: ["back"] },
  adductors: { region: "adductors", label: "Binnen-/buitenbeen", views: ["front"] },
  calves: { region: "calves", label: "Kuiten", views: ["front", "back"] },
};

/** Vaste volgorde van alle regio's (radar-assen, legenda's). */
export const MUSCLE_REGION_ORDER: MuscleRegion[] = Object.keys(
  MUSCLE_REGIONS
) as MuscleRegion[];

/**
 * Ruwe spier-labels (uit catalogus of eigen oefening, lowercase) → regio.
 * Bevat synoniemen/varianten uit de dataset (target/muscleGroup/secondaryMuscles).
 * Onbekend of niet-lichaamsdeel (bv. "cardiovascular system") → geen regio.
 */
const RAW_TO_REGION: Record<string, MuscleRegion> = {
  // Borst
  pectorals: "chest",
  chest: "chest",
  "serratus anterior": "obliques",
  // Schouders
  delts: "shoulders",
  deltoids: "shoulders",
  shoulders: "shoulders",
  "front delts": "shoulders",
  "side/rear delts": "shoulders",
  "rear delts": "shoulders",
  "rotator cuff": "shoulders",
  // Armen
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  "wrist flexors": "forearms",
  "wrist extensors": "forearms",
  wrists: "forearms",
  hands: "forearms",
  // Buik
  abs: "abs",
  abdominals: "abs",
  core: "abs",
  obliques: "obliques",
  // Nek / bovenrug
  traps: "traps",
  trapezius: "traps",
  "levator scapulae": "traps",
  lats: "lats",
  "latissimus dorsi": "lats",
  "upper back": "upperBack",
  rhomboids: "upperBack",
  // Onderrug
  spine: "lowerBack",
  "lower back": "lowerBack",
  // Onderlichaam
  glutes: "glutes",
  quads: "quads",
  quadriceps: "quads",
  "hip flexors": "quads",
  hamstrings: "hamstrings",
  adductors: "adductors",
  abductors: "adductors",
  calves: "calves",
  soleus: "calves",
  ankles: "calves",
  "ankle stabilizers": "calves",
};

/** Normaliseer één ruw spier-label naar een regio (of null als onbekend/n.v.t.). */
export function resolveRegion(raw: string | null | undefined): MuscleRegion | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return RAW_TO_REGION[key] ?? null;
}

// --- Volume-niveaus (heatmap-kleuren) --------------------------------------
//
// De heatmap kleurt elke regio op basis van het wekelijkse set-volume dat het
// schema eraan besteedt. De grenzen volgen gangbare hypertrofie-richtlijnen
// (±10 sets/week is een degelijk startpunt). Niveau 0 = niet getraind.

export type MuscleLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type MuscleLevelMeta = {
  level: MuscleLevel;
  label: string;
  /** Vaste kleur (hex) — bewust niet tenant-accent: het is een betekenis-schaal. */
  color: string;
};

/** Legenda-/kleurschaal voor de heatmap (0 = grijs, 1..5 = rood→groen→zwart). */
export const MUSCLE_LEVELS: MuscleLevelMeta[] = [
  { level: 0, label: "Niet getraind", color: "#d4d4d4" },
  { level: 1, label: "Weinig", color: "#f87171" },
  { level: 2, label: "Matig", color: "#fbbf24" },
  { level: 3, label: "Goed", color: "#86efac" },
  { level: 4, label: "Veel", color: "#22c55e" },
  { level: 5, label: "Zeer veel", color: "#166534" },
];

export const MUSCLE_LEVEL_COLOR: Record<MuscleLevel, string> = {
  0: "#d4d4d4",
  1: "#f87171",
  2: "#fbbf24",
  3: "#86efac",
  4: "#22c55e",
  5: "#166534",
};

/** Wekelijks set-volume → niveau (0..5). */
export function levelForWeeklySets(sets: number): MuscleLevel {
  if (sets <= 0) return 0;
  if (sets < 6) return 1;
  if (sets < 10) return 2;
  if (sets < 14) return 3;
  if (sets < 20) return 4;
  return 5;
}
