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
  // benaderbaar op de heatmap. Vgl. REGION_SHARED_POLYGON voor lats.
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
 * Regio's zónder eigen polygoon in de gevendorde body-dataset, met de polygoon
 * waarop ze méékleuren.
 *
 * De MIT-dataset (react-body-highlighter) vat de lats samen in één
 * upper-back-vorm, terwijl de RepDB-bibliotheek `latissimus_dorsi` wél apart
 * onderscheidt. Zonder deze koppeling zou lat pulldown- en roeivolume nergens op
 * de figuur oplichten. De geometrie blijft ongemoeid — die is gegenereerd uit de
 * MIT-bron (zie components/muscle/body-model-data.ts) en wordt niet met de hand
 * gesplitst; de polygoon draagt dus méérdere spieren en kleurt op de zwaarst
 * belaste ervan (som zou hetzelfde oppervlak dubbel tellen).
 *
 * Een test dwingt af dat élke regio zichtbaar is: eigen polygoon óf hier gekoppeld.
 */
export const REGION_SHARED_POLYGON: Partial<Record<MuscleRegion, MuscleRegion>> = {
  lats: "upperBack",
};

/**
 * Alle regio's die op de polygonen van `region` worden weergegeven — `region`
 * zelf eerst, daarna de meeliftende regio's. Gebruikt door de heatmap voor kleur,
 * `aria-label` en het detailpaneel.
 */
export function regionsOnPolygon(region: MuscleRegion): MuscleRegion[] {
  const shared = MUSCLE_REGION_ORDER.filter(
    (r) => REGION_SHARED_POLYGON[r] === region
  );
  return [region, ...shared];
}

/**
 * Ruwe spier-labels (uit catalogus of eigen oefening, lowercase) → regio.
 * Bevat synoniemen/varianten uit de dataset (target/muscleGroup/secondaryMuscles).
 * Onbekend of niet-lichaamsdeel (bv. "cardiovascular system") → geen regio.
 */
const RAW_TO_REGION: Record<string, MuscleRegion> = {
  // Borst
  pectorals: "chest",
  chest: "chest",
  "pectoralis major": "chest",
  "serratus anterior": "obliques",
  // Schouders
  delts: "shoulders",
  deltoids: "shoulders",
  shoulders: "shoulders",
  "front delts": "shoulders",
  "side/rear delts": "shoulders",
  "rear delts": "shoulders",
  "rotator cuff": "shoulders",
  "anterior deltoid": "shoulders",
  "lateral deltoid": "shoulders",
  "posterior deltoid": "shoulders",
  supraspinatus: "shoulders",
  // Armen
  biceps: "biceps",
  "biceps brachii": "biceps",
  brachialis: "biceps",
  triceps: "triceps",
  "triceps brachii": "triceps",
  forearms: "forearms",
  "forearm extensors": "forearms",
  "forearm flexors": "forearms",
  brachioradialis: "forearms",
  "wrist flexors": "forearms",
  "wrist extensors": "forearms",
  wrists: "forearms",
  hands: "forearms",
  // Buik
  abs: "abs",
  abdominals: "abs",
  core: "abs",
  "rectus abdominis": "abs",
  "transverse abdominis": "abs",
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
  "erector spinae": "lowerBack",
  "quadratus lumborum": "lowerBack",
  // Onderlichaam
  glutes: "glutes",
  "gluteus maximus": "glutes",
  "gluteus medius": "glutes",
  quads: "quads",
  quadriceps: "quads",
  "hip flexors": "quads",
  hamstrings: "hamstrings",
  adductors: "adductors",
  abductors: "adductors",
  calves: "calves",
  soleus: "calves",
  gastrocnemius: "calves",
  ankles: "calves",
  "ankle stabilizers": "calves",

  // --- Weergavenamen van de bibliotheek (LibraryMuscle.names.en) -------------
  // De slugs resolven al via de regels hierboven; deze vier en-namen wijken
  // dáárvan af en komen als vrij label mee in `Exercise.targetMuscle` (gezet bij
  // het toevoegen aan een sportschool). Zonder deze regels vallen ze stil weg.
  "side delts": "shoulders", // lateral_deltoid
  "glute medius": "glutes", // gluteus_medius
  "deep core": "abs", // transverse_abdominis
  serratus: "obliques", // serratus_anterior

  // --- Nederlandse labels ---------------------------------------------------
  // De UI is Nederlands: bij een eigen oefening typt de sportschool "Borst" of
  // "Bilspieren" in `targetMuscle`/`muscleGroups`. Alleen ondubbelzinnige
  // anatomische termen staan hier — "benen"/"bovenbenen"/"hele lichaam" dekken
  // meerdere regio's en worden bewust niet gegokt (liever geen kleur dan de
  // verkeerde spier oplichten).
  borst: "chest",
  schouders: "shoulders",
  onderarmen: "forearms",
  buik: "abs",
  "schuine buik": "obliques",
  bovenrug: "upperBack",
  onderrug: "lowerBack",
  bilspieren: "glutes",
  bilen: "glutes",
  latissimus: "lats",
  kuiten: "calves",
  adductoren: "adductors",
  binnenbeen: "adductors",
  buitenbeen: "adductors",

  // --- Nederlandse weergavenamen van de bibliotheek (LibraryMuscle.names.nl) --
  // Tegenhanger van de en-namen hierboven: sinds de lookups een `nl`-naam hebben
  // (lib/translate/library-lookups-nl.ts) belandt de Nederlandse variant als vrij
  // label in `Exercise.targetMuscle`. Zonder deze regels zou de heatmap stil
  // stoppen met kleuren; `tests/library-lookups-nl.test.ts` dwingt de dekking af.
  abductoren: "adductors",
  "voorste deltoïden": "shoulders",
  "middelste deltoïden": "shoulders",
  "achterste deltoïden": "shoulders",
  onderarmstrekkers: "forearms",
  onderarmbuigers: "forearms",
  "middelste bilspier": "glutes",
  heupbuigers: "quads", // zoals "hip flexors"
  "schuine buikspieren": "obliques",
  buikspieren: "abs",
  "diepe buikspieren": "abs",
  rhomboïden: "upperBack",
};

/** Normaliseer één ruw spier-label naar een regio (of null als onbekend/n.v.t.).
 *  Underscores worden als spaties gelezen zodat RepDB-slugs ("biceps_brachii")
 *  dezelfde tabel raken als vrije labels ("biceps brachii"). */
export function resolveRegion(raw: string | null | undefined): MuscleRegion | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/_/g, " ");
  return RAW_TO_REGION[key] ?? null;
}

// --- Set-volume per regio (telregel) ---------------------------------------
//
// Puur en getest, zodat de heatmap-telling verifieerbaar is zonder database.
// De server-laag (lib/muscle-analysis.ts) levert alleen de rijen aan.

/** Spier-relevante velden van een tenant-`Exercise`, 3-weg (bibliotheek/klassiek/eigen). */
export type ExerciseMuscleInfo = {
  targetMuscle: string | null;
  muscleGroups: string[];
  catalog: {
    target: string | null;
    muscleGroup: string | null;
    secondaryMuscles: string[];
  } | null;
  library: {
    primaryMuscles: string[];
    secondaryMuscles: string[];
  } | null;
};

/**
 * Primaire spieren van een oefening. Bij een bibliotheek-oefening (RepDB) zijn
 * de gecureerde slugs leidend — dáár staan er vaak meerdere (een squat =
 * quadriceps + bilspieren) en die tellen allemaal vol. `targetMuscle` is bij zo'n
 * oefening slechts één afgeleide weergavenaam. Anders: eigen `targetMuscle` wint
 * van de klassieke catalogus.
 */
export function primaryMuscleRaws(ex: ExerciseMuscleInfo): string[] {
  const lib = ex.library?.primaryMuscles ?? [];
  if (lib.length > 0) return lib;
  const single = ex.targetMuscle ?? ex.catalog?.target ?? ex.catalog?.muscleGroup ?? null;
  return single ? [single] : [];
}

/** Secundaire spieren (bibliotheek + catalogus + eigen extra spiergroepen). */
export function secondaryMuscleRaws(ex: ExerciseMuscleInfo): string[] {
  return [
    ...(ex.library?.secondaryMuscles ?? []),
    ...(ex.catalog?.secondaryMuscles ?? []),
    ...(ex.muscleGroups ?? []),
  ];
}

/**
 * Verdeel `sets` van één oefening over de spierregio's: primair vol, secundair
 * half. Per oefening telt elke regio maximaal één keer — een regio die al
 * primair geraakt is krijgt geen halve secundaire bonus erbovenop. Muteert
 * `acc` in-place (opteller over alle oefeningen van een schema/periode).
 */
export function accumulateMuscleVolume(
  acc: Map<MuscleRegion, number>,
  ex: ExerciseMuscleInfo,
  sets: number
): void {
  const seen = new Set<MuscleRegion>();
  for (const raw of primaryMuscleRaws(ex)) {
    const region = resolveRegion(raw);
    if (!region || seen.has(region)) continue;
    seen.add(region);
    acc.set(region, (acc.get(region) ?? 0) + sets);
  }
  for (const raw of secondaryMuscleRaws(ex)) {
    const region = resolveRegion(raw);
    if (!region || seen.has(region)) continue;
    seen.add(region);
    acc.set(region, (acc.get(region) ?? 0) + sets * 0.5);
  }
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
