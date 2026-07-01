// Oefeningstype-registry — één bron van waarheid voor de "slimme" oefeningen.
//
// Bewust GEEN `server-only`: dit wordt zowel server-side (actions/validatie) als
// client-side (schema-editor, oefeningformulier, live tracking) gebruikt — net
// als lib/errors.ts, lib/rbac.ts en lib/email/template-defaults.ts.
//
// Elke oefening heeft een `exerciseType` (String-kolom op Exercise). Het type
// bepaalt wélke parameters relevant zijn: de coach ziet in de schema-editor
// alléén de `targetFields`, de sporter logt alléén de `logFields`. Een nieuw
// type toevoegen = één record hieronder (geen DB-migratie nodig).

import {
  Dumbbell,
  Heart,
  Activity,
  Timer,
  Flame,
  RotateCcw,
  Target,
  Sparkles,
  PersonStanding,
  Scale,
  HeartPulse,
  type LucideIcon,
} from "@/components/ui/icons";

/**
 * Eén invoerveld van een oefeningstype.
 *
 * `kind` bepaalt opslag/parsing:
 * - "int"/"float": numerieke waarde, opgeslagen zoals ingevoerd.
 * - "duration":   ingevoerd in `unit` ("min"|"sec"), ALTIJD opgeslagen in seconden.
 * - "distance":   ingevoerd in `unit` ("km"|"m"),   ALTIJD opgeslagen in meters.
 * - "enum":       string uit `options`.
 * - "text":       vrije tekst.
 *
 * `column` koppelt een veld aan een bestaande WorkoutExerciseItem-kolom
 * (sets/reps/weightKg/restSeconds). Velden zónder `column` leven in de
 * `params` JSON-kolom. Zo blijven alle bestaande kracht-leessites werken.
 */
export type ParamFieldKind = "int" | "float" | "duration" | "distance" | "enum" | "text";

export type ParamField = {
  id: string;
  label: string;
  kind: ParamFieldKind;
  unit?: string; // invoer-eenheid / weergave-suffix
  column?: "sets" | "reps" | "weightKg" | "restSeconds" | "tempo";
  required?: boolean;
  /** Markeer expliciet optionele velden (toont een "optioneel"-hint in de UI). */
  optional?: boolean;
  default?: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Korte hint onder het label (optioneel). */
  help?: string;
};

export type LogModel = "sets" | "single";

export type ExerciseTypeDef = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Tailwind tekst/achtergrond-tint voor het type-chip (statisch, geen runtime kleur). */
  tone: string;
  description: string;
  /** "sets" = multi-set tracking (kracht/isometrisch/core); "single" = één resultaat-entry. */
  logModel: LogModel;
  /** Wat de coach in het schema invult ("doel"). */
  targetFields: ParamField[];
  /** Wat de sporter tijdens de training logt. */
  logFields: ParamField[];
};

// --- Herbruikbare veld-bouwstenen ----------------------------------------

const F = {
  sets: (): ParamField => ({
    id: "sets",
    label: "Sets",
    kind: "int",
    column: "sets",
    required: true,
    default: 3,
    min: 1,
    max: 20,
  }),
  reps: (opt = false): ParamField => ({
    id: "reps",
    label: "Herhalingen",
    kind: "int",
    column: "reps",
    required: !opt,
    optional: opt,
    default: opt ? undefined : 10,
    min: 0,
    max: 100,
  }),
  weightKg: (): ParamField => ({
    id: "weightKg",
    label: "Gewicht",
    kind: "float",
    unit: "kg",
    column: "weightKg",
    min: 0,
    max: 1000,
    step: 0.5,
  }),
  rest: (): ParamField => ({
    id: "restSeconds",
    label: "Rust",
    kind: "duration",
    unit: "sec",
    column: "restSeconds",
    default: 60,
    min: 0,
    max: 3600,
  }),
  tempo: (): ParamField => ({
    id: "tempo",
    label: "Tempo",
    kind: "text",
    column: "tempo",
    optional: true,
    placeholder: "3-1-1",
    help: "Excentrisch-pauze-concentrisch",
  }),
  timeMin: (id = "timeSeconds", label = "Tijd", required = true): ParamField => ({
    id,
    label,
    kind: "duration",
    unit: "min",
    required,
    default: 1800,
    min: 0,
    max: 36000,
  }),
  timeSec: (id = "timeSeconds", label = "Tijd", required = true): ParamField => ({
    id,
    label,
    kind: "duration",
    unit: "sec",
    required,
    min: 0,
    max: 36000,
  }),
  distanceKm: (required = false): ParamField => ({
    id: "distanceM",
    label: "Afstand",
    kind: "distance",
    unit: "km",
    required,
    min: 0,
    max: 1000000,
    step: 0.1,
  }),
  intensity: (): ParamField => ({
    id: "intensity",
    label: "Intensiteit",
    kind: "enum",
    options: [
      { value: "laag", label: "Laag" },
      { value: "middel", label: "Middel" },
      { value: "hoog", label: "Hoog" },
    ],
  }),
  hrZone: (): ParamField => ({
    id: "hrZone",
    label: "Hartslagzone",
    kind: "enum",
    options: [1, 2, 3, 4, 5].map((z) => ({ value: `zone${z}`, label: `Zone ${z}` })),
  }),
  avgSpeed: (): ParamField => ({
    id: "avgSpeed",
    label: "Gem. snelheid",
    kind: "float",
    unit: "km/u",
    min: 0,
    max: 100,
    step: 0.1,
  }),
  avgHr: (): ParamField => ({
    id: "avgHr",
    label: "Gem. hartslag",
    kind: "int",
    unit: "bpm",
    min: 0,
    max: 250,
  }),
  pace: (): ParamField => ({
    id: "pace",
    label: "Tempo",
    kind: "text",
    placeholder: "5:30 /km",
  }),
  rounds: (required = true): ParamField => ({
    id: "rounds",
    label: "Rondes",
    kind: "int",
    required,
    default: 3,
    min: 1,
    max: 100,
  }),
  side: (): ParamField => ({
    id: "side",
    label: "Kant",
    kind: "enum",
    options: [
      { value: "beide", label: "Beide" },
      { value: "links", label: "Links" },
      { value: "rechts", label: "Rechts" },
    ],
  }),
  notes: (): ParamField => ({
    id: "paramNotes",
    label: "Opmerkingen",
    kind: "text",
    optional: true,
    placeholder: "bv. let op je ademhaling",
  }),
};

// --- De registry ----------------------------------------------------------

export const EXERCISE_TYPES: Record<string, ExerciseTypeDef> = {
  strength: {
    key: "strength",
    label: "Krachttraining",
    icon: Dumbbell,
    tone: "bg-accent-soft text-accent",
    description: "Sets, herhalingen en gewicht — de klassieke krachtoefening.",
    logModel: "sets",
    targetFields: [F.sets(), F.reps(), F.weightKg(), F.tempo(), F.rest()],
    logFields: [F.reps(), F.weightKg()],
  },
  cardio: {
    key: "cardio",
    label: "Cardiotraining",
    icon: Heart,
    tone: "bg-rose-50 text-rose-600",
    description: "Tijd, afstand en intensiteit — hardlopen, fietsen, roeien.",
    logModel: "single",
    targetFields: [F.timeMin(), F.distanceKm(), F.intensity(), F.hrZone(), F.avgSpeed()],
    logFields: [F.timeMin(), F.distanceKm(), F.intensity(), F.hrZone(), F.avgSpeed()],
  },
  endurance: {
    key: "endurance",
    label: "Duurtraining",
    icon: Activity,
    tone: "bg-sky-50 text-sky-600",
    description: "Langere duurinspanning met tempo en hartslag.",
    logModel: "single",
    targetFields: [F.timeMin(), F.distanceKm(), F.pace(), F.avgHr()],
    logFields: [F.timeMin(), F.distanceKm(), F.pace(), F.avgHr()],
  },
  isometric: {
    key: "isometric",
    label: "Isometrisch",
    icon: Timer,
    tone: "bg-amber-50 text-amber-600",
    description: "Statisch vasthouden, zoals plank — sets met houdtijd, geen herhalingen.",
    logModel: "sets",
    targetFields: [F.sets(), F.timeSec("holdSeconds", "Houdtijd"), F.rest()],
    logFields: [F.timeSec("holdSeconds", "Houdtijd")],
  },
  mobility: {
    key: "mobility",
    label: "Mobiliteit",
    icon: Activity,
    tone: "bg-teal-50 text-teal-600",
    description: "Mobiliteitswerk per kant, met tijd en opmerkingen.",
    logModel: "single",
    targetFields: [F.timeSec(), F.side(), F.notes()],
    logFields: [F.timeSec(), F.side()],
  },
  stretch: {
    key: "stretch",
    label: "Stretching",
    icon: Sparkles,
    tone: "bg-violet-50 text-violet-600",
    description: "Rekken: vasthouden op tijd, optioneel een aantal herhalingen.",
    logModel: "single",
    targetFields: [F.timeSec(), F.reps(true)],
    logFields: [F.timeSec(), F.reps(true)],
  },
  circuit: {
    key: "circuit",
    label: "Circuit",
    icon: RotateCcw,
    tone: "bg-indigo-50 text-indigo-600",
    description: "Rondes met tijd en rust tussen de rondes.",
    logModel: "single",
    targetFields: [F.rounds(), F.timeMin(), F.rest()],
    logFields: [F.rounds(), F.timeMin()],
  },
  hiit: {
    key: "hiit",
    label: "HIIT",
    icon: Flame,
    tone: "bg-orange-50 text-orange-600",
    description: "Interval: werkduur, rustduur en aantal rondes.",
    logModel: "single",
    targetFields: [
      F.timeSec("workSeconds", "Werkduur"),
      F.timeSec("restWorkSeconds", "Rustduur"),
      F.rounds(),
    ],
    logFields: [F.rounds()],
  },
  core: {
    key: "core",
    label: "Core",
    icon: Target,
    tone: "bg-lime-50 text-lime-600",
    description: "Buik/core — afhankelijk van de oefening op tijd óf op herhalingen.",
    logModel: "sets",
    targetFields: [F.sets(), F.reps(true), F.timeSec("timeSeconds", "Tijd", false), F.rest()],
    logFields: [F.reps(true), F.timeSec("timeSeconds", "Tijd", false)],
  },
  functional: {
    key: "functional",
    label: "Functionele training",
    icon: PersonStanding,
    tone: "bg-cyan-50 text-cyan-600",
    description: "Samengestelde bewegingspatronen — herhalingen met optioneel gewicht en rust.",
    logModel: "sets",
    targetFields: [F.sets(), F.reps(), { ...F.weightKg(), optional: true }, F.rest(), F.notes()],
    logFields: [F.reps(), F.weightKg()],
  },
  stability: {
    key: "stability",
    label: "Stabiliteit & balans",
    icon: Scale,
    tone: "bg-emerald-50 text-emerald-600",
    description: "Balans- en stabiliteitswerk — vasthouden per kant, met rust.",
    logModel: "sets",
    targetFields: [F.sets(), F.timeSec("holdSeconds", "Houdtijd"), F.side(), F.rest()],
    logFields: [F.timeSec("holdSeconds", "Houdtijd"), F.side()],
  },
  rehab: {
    key: "rehab",
    label: "Revalidatie",
    icon: HeartPulse,
    tone: "bg-pink-50 text-pink-600",
    description: "Gecontroleerde herstel-/blessurepreventie-oefeningen — rustig, vaak per kant.",
    logModel: "sets",
    targetFields: [F.sets(), F.reps(true), F.timeSec("timeSeconds", "Tijd", false), F.side(), F.notes(), F.rest()],
    logFields: [F.reps(true), F.timeSec("timeSeconds", "Tijd", false), F.side()],
  },
  other: {
    key: "other",
    label: "Overig",
    icon: Dumbbell,
    tone: "bg-neutral-100 text-neutral-600",
    description: "Volledig vrij — kies zelf welke velden je invult.",
    logModel: "single",
    targetFields: [
      { ...F.sets(), required: false },
      F.reps(true),
      F.weightKg(),
      F.timeSec("timeSeconds", "Tijd", false),
      F.distanceKm(false),
      F.notes(),
    ],
    logFields: [
      { ...F.reps(true) },
      F.weightKg(),
      F.timeSec("timeSeconds", "Tijd", false),
      F.distanceKm(false),
    ],
  },
};

export const EXERCISE_TYPE_KEYS = Object.keys(EXERCISE_TYPES) as [string, ...string[]];

export const DEFAULT_EXERCISE_TYPE = "strength";

/** Veilige lookup met fallback op het default-type. */
export function getExerciseType(key: string | null | undefined): ExerciseTypeDef {
  return (key && EXERCISE_TYPES[key]) || EXERCISE_TYPES[DEFAULT_EXERCISE_TYPE];
}

export function exerciseTypeLabel(key: string | null | undefined): string {
  return getExerciseType(key).label;
}

/** Opties voor een <select> (value + label, in registry-volgorde). */
export function exerciseTypeOptions(): { value: string; label: string }[] {
  return Object.values(EXERCISE_TYPES).map((t) => ({ value: t.key, label: t.label }));
}

export function isExerciseType(key: string | null | undefined): key is string {
  return Boolean(key && key in EXERCISE_TYPES);
}

/**
 * Heuristiek: leid een oefeningstype af uit de catalogus-velden
 * (category/equipment/bodyPart). Een voorstel — de owner kan altijd bijsturen.
 * Mirror van suggestMachineType (lib/machine.ts).
 */
export function inferExerciseType(input: {
  category?: string | null;
  equipment?: string | null;
  bodyPart?: string | null;
  target?: string | null;
}): string {
  const c = (input.category ?? "").toLowerCase();
  const e = (input.equipment ?? "").toLowerCase();
  const b = (input.bodyPart ?? "").toLowerCase();
  const t = (input.target ?? "").toLowerCase();

  if (/stretch/.test(c) || /stretch/.test(t)) return "stretch";
  if (/(rehab|prehab|revalidat|rehabilit)/.test(c) || /(rehab|revalidat)/.test(t)) return "rehab";
  if (/plyometric/.test(c)) return "hiit";
  if (/cardio/.test(c) || /cardio/.test(b)) return "cardio";
  if (/(treadmill|bike|cycle|elliptical|rower|rowing|stair|stepmill|skierg|ergometer)/.test(e))
    return "cardio";
  if (/(balance|stability|stabili)/.test(c) || /(balance|stability|stabili)/.test(t) || /bosu|balance/.test(e))
    return "stability";
  if (/(plank|hold|isometric)/.test(t)) return "isometric";
  if (/(waist|abs|core)/.test(b) || /(abdominals|core)/.test(t)) return "core";
  if (/functional/.test(c) || /functional/.test(t)) return "functional";
  return "strength";
}
