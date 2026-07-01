// Achievement-registry — dé bron van waarheid voor álle trofeeën/mijlpalen.
//
// Idiomatisch zoals lib/exercise-types.ts, lib/training-goals.ts en
// lib/audit-actions.ts: code-gestuurd, GEEN `server-only` (ook client-side voor
// badges), en **toekomstbestendig** — een nieuwe achievement toevoegen is één
// record hieronder, zónder aanpassingen aan de engine, UI of database.
//
// Elke definitie koppelt een `metric` (berekend in lib/achievements/metrics.ts)
// aan een `threshold`. Behaald = metricwaarde ≥ threshold. Voortgang is generiek
// `min(1, waarde / threshold)` — dus geen per-achievement logica nodig.

import {
  Dumbbell,
  Flame,
  Trophy,
  Medal,
  Award,
  Crown,
  Gem,
  Heart,
  Activity,
  Timer,
  Target,
  Ruler,
  Scale,
  ShieldCheck,
  Footprints,
  Star,
  CheckCircle2,
  type LucideIcon,
} from "@/components/ui/icons";
import type { Rarity } from "@/lib/achievements/rarity";

/** Categorieën — bepalen de secties op de Trofeeën-pagina. */
export type AchievementCategory =
  | "training"
  | "consistency"
  | "strength"
  | "cardio"
  | "goals"
  | "community";

export const CATEGORY_META: Record<
  AchievementCategory,
  { label: string; description: string; icon: LucideIcon }
> = {
  training: {
    label: "Training",
    description: "Mijlpalen voor het aantal voltooide trainingen.",
    icon: Dumbbell,
  },
  consistency: {
    label: "Consistentie",
    description: "Beloningen voor regelmatig en volhoudend trainen.",
    icon: Flame,
  },
  strength: {
    label: "Kracht",
    description: "Volume, records en krachtmijlpalen.",
    icon: Trophy,
  },
  cardio: {
    label: "Cardio",
    description: "Afstand, tijd en duurmijlpalen.",
    icon: Heart,
  },
  goals: {
    label: "Doelen",
    description: "Persoonlijke doelen en lichaamssamenstelling.",
    icon: Target,
  },
  community: {
    label: "Community",
    description: "Je profiel, eerste stappen en betrokkenheid.",
    icon: ShieldCheck,
  },
};

/** Metrics die de engine berekent — zie lib/achievements/metrics.ts. */
export type MetricKey =
  | "totalWorkouts"
  | "longestStreakDays"
  | "memberSinceDays"
  | "totalVolume"
  | "prCount"
  | "maxSquatKg"
  | "maxDeadliftKg"
  | "longestRunM"
  | "totalDistanceM"
  | "totalCardioSec"
  | "goalsAchieved"
  | "bodyFatImproved"
  | "muscleGained"
  | "measurementsCount"
  | "profileComplete"
  | "schemasCompleted";

export type AchievementDef = {
  /** Stabiele, unieke key (wordt in de DB bewaard) — nooit hernoemen. */
  key: string;
  category: AchievementCategory;
  rarity: Rarity;
  title: string;
  /** Korte, motiverende omschrijving (sporter-gericht). */
  description: string;
  icon: LucideIcon;
  metric: MetricKey;
  threshold: number;
  /** Eenheid voor voortgang ("trainingen", "kg", "km", "dagen", …). */
  unit?: string;
  /** Toon deze waarde in km i.p.v. meters (afstand-metrics). */
  displayKm?: boolean;
  /** Toon deze waarde in uren i.p.v. seconden (tijd-metrics). */
  displayHours?: boolean;
  /** Verborgen tot behaald (geheime achievement). */
  hidden?: boolean;
  /** Verschijnt ook als stempel in het Gym Passport. */
  passport?: boolean;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- Training (aantal voltooide trainingen) ---
  { key: "training.first", category: "training", rarity: "bronze", title: "Eerste training", description: "Je allereerste training voltooid. Het begin van je reis.", icon: Dumbbell, metric: "totalWorkouts", threshold: 1, unit: "trainingen", passport: true },
  { key: "training.count_10", category: "training", rarity: "bronze", title: "10 trainingen", description: "Tien trainingen op de teller — de gewoonte groeit.", icon: Dumbbell, metric: "totalWorkouts", threshold: 10, unit: "trainingen" },
  { key: "training.count_50", category: "training", rarity: "silver", title: "50 trainingen", description: "Vijftig trainingen voltooid. Serieuze toewijding.", icon: Medal, metric: "totalWorkouts", threshold: 50, unit: "trainingen", passport: true },
  { key: "training.count_100", category: "training", rarity: "gold", title: "100 trainingen", description: "Honderd trainingen — je bent een vaste waarde.", icon: Award, metric: "totalWorkouts", threshold: 100, unit: "trainingen", passport: true },
  { key: "training.count_250", category: "training", rarity: "platinum", title: "250 trainingen", description: "Tweehonderdvijftig trainingen. Indrukwekkend volhouden.", icon: Crown, metric: "totalWorkouts", threshold: 250, unit: "trainingen" },
  { key: "training.count_500", category: "training", rarity: "diamond", title: "500 trainingen", description: "Vijfhonderd trainingen. Een ware veteraan.", icon: Gem, metric: "totalWorkouts", threshold: 500, unit: "trainingen", passport: true },

  // --- Consistentie (aaneengesloten dagen + lidmaatschap) ---
  { key: "consistency.streak_3", category: "consistency", rarity: "bronze", title: "3 dagen op rij", description: "Drie dagen achter elkaar getraind.", icon: Flame, metric: "longestStreakDays", threshold: 3, unit: "dagen" },
  { key: "consistency.streak_7", category: "consistency", rarity: "silver", title: "7 dagen op rij", description: "Een volle week elke dag getraind.", icon: Flame, metric: "longestStreakDays", threshold: 7, unit: "dagen", passport: true },
  { key: "consistency.streak_30", category: "consistency", rarity: "gold", title: "30 dagen op rij", description: "Een maand lang dagelijkse discipline.", icon: Flame, metric: "longestStreakDays", threshold: 30, unit: "dagen" },
  { key: "consistency.streak_100", category: "consistency", rarity: "diamond", title: "100 dagen op rij", description: "Honderd dagen onafgebroken. Legendarische discipline.", icon: Gem, metric: "longestStreakDays", threshold: 100, unit: "dagen" },
  { key: "consistency.member_365", category: "consistency", rarity: "platinum", title: "1 jaar actief", description: "Een heel jaar lid van je sportschool.", icon: Crown, metric: "memberSinceDays", threshold: 365, unit: "dagen", passport: true },

  // --- Kracht (volume + records) ---
  { key: "strength.first_pr", category: "strength", rarity: "bronze", title: "Eerste PR", description: "Je eerste persoonlijk record gezet.", icon: Trophy, metric: "prCount", threshold: 1, unit: "PR's", passport: true },
  { key: "strength.volume_100", category: "strength", rarity: "bronze", title: "100 kg verplaatst", description: "In totaal 100 kg verplaatst.", icon: Dumbbell, metric: "totalVolume", threshold: 100, unit: "kg" },
  { key: "strength.volume_1000", category: "strength", rarity: "silver", title: "1.000 kg verplaatst", description: "Duizend kilo totaal volume getild.", icon: Dumbbell, metric: "totalVolume", threshold: 1000, unit: "kg" },
  { key: "strength.volume_10000", category: "strength", rarity: "gold", title: "10.000 kg verplaatst", description: "Tienduizend kilo totaal — dat telt op.", icon: Award, metric: "totalVolume", threshold: 10000, unit: "kg" },
  { key: "strength.volume_100000", category: "strength", rarity: "platinum", title: "100.000 kg verplaatst", description: "Honderdduizend kilo totaal volume.", icon: Crown, metric: "totalVolume", threshold: 100000, unit: "kg" },
  { key: "strength.volume_1000000", category: "strength", rarity: "legendary", title: "1.000.000 kg verplaatst", description: "Een miljoen kilo verplaatst. Ongeëvenaard.", icon: Gem, metric: "totalVolume", threshold: 1000000, unit: "kg" },
  { key: "strength.squat_100", category: "strength", rarity: "gold", title: "100 kg squat", description: "Je eerste squat met 100 kg.", icon: Dumbbell, metric: "maxSquatKg", threshold: 100, unit: "kg" },
  { key: "strength.deadlift_100", category: "strength", rarity: "gold", title: "100 kg deadlift", description: "Je eerste deadlift met 100 kg.", icon: Dumbbell, metric: "maxDeadliftKg", threshold: 100, unit: "kg" },

  // --- Cardio (afstand + tijd) ---
  { key: "cardio.first_5k", category: "cardio", rarity: "bronze", title: "Eerste 5 km", description: "Vijf kilometer in één sessie.", icon: Footprints, metric: "longestRunM", threshold: 5000, unit: "km", displayKm: true },
  { key: "cardio.run_10k", category: "cardio", rarity: "silver", title: "10 km", description: "Tien kilometer in één sessie.", icon: Footprints, metric: "longestRunM", threshold: 10000, unit: "km", displayKm: true },
  { key: "cardio.distance_100k", category: "cardio", rarity: "gold", title: "100 km totaal", description: "Honderd kilometer aan cardio bij elkaar.", icon: Activity, metric: "totalDistanceM", threshold: 100000, unit: "km", displayKm: true },
  { key: "cardio.time_10h", category: "cardio", rarity: "silver", title: "10 uur cardio", description: "Tien uur cardio in totaal.", icon: Timer, metric: "totalCardioSec", threshold: 36000, unit: "uur", displayHours: true },
  { key: "cardio.marathon_training", category: "cardio", rarity: "legendary", title: "Marathontraining", description: "Een lange duurloop van 30 km voltooid.", icon: Crown, metric: "longestRunM", threshold: 30000, unit: "km", displayKm: true },

  // --- Doelen (persoonlijke doelen + lichaamssamenstelling) ---
  { key: "goals.first", category: "goals", rarity: "bronze", title: "Eerste doel behaald", description: "Je eerste persoonlijke doel bereikt.", icon: Target, metric: "goalsAchieved", threshold: 1, unit: "doelen", passport: true },
  { key: "goals.count_3", category: "goals", rarity: "silver", title: "3 doelen behaald", description: "Drie persoonlijke doelen bereikt.", icon: Target, metric: "goalsAchieved", threshold: 3, unit: "doelen" },
  { key: "goals.bodyfat_improved", category: "goals", rarity: "silver", title: "Vetpercentage verbeterd", description: "Je vetpercentage is aantoonbaar gedaald.", icon: Scale, metric: "bodyFatImproved", threshold: 1 },
  { key: "goals.muscle_gained", category: "goals", rarity: "silver", title: "Spiermassa gegroeid", description: "Je spiermassa is aantoonbaar toegenomen.", icon: Activity, metric: "muscleGained", threshold: 1 },
  { key: "goals.first_measurement", category: "goals", rarity: "bronze", title: "Eerste lichaamsmeting", description: "Je eerste lichaamsmeting voltooid.", icon: Ruler, metric: "measurementsCount", threshold: 1, unit: "metingen" },

  // --- Community (profiel + eerste stappen) ---
  { key: "community.profile_complete", category: "community", rarity: "bronze", title: "Profiel compleet", description: "Je profiel volledig ingevuld.", icon: CheckCircle2, metric: "profileComplete", threshold: 1, passport: true },
  { key: "community.first_schema_done", category: "community", rarity: "bronze", title: "Eerste schema afgerond", description: "Je eerste trainingsschema volledig doorlopen.", icon: Star, metric: "schemasCompleted", threshold: 1, passport: true },
  { key: "community.first_measurement", category: "community", rarity: "bronze", title: "Eerste meting toegevoegd", description: "Je eerste meting geregistreerd.", icon: Ruler, metric: "measurementsCount", threshold: 1, unit: "metingen" },
];

/** Snelle lookup per key. */
export const ACHIEVEMENTS_BY_KEY: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.key, a])
);

export function getAchievementDef(key: string): AchievementDef | null {
  return ACHIEVEMENTS_BY_KEY[key] ?? null;
}

export const CATEGORY_ORDER: AchievementCategory[] = [
  "training",
  "consistency",
  "strength",
  "cardio",
  "goals",
  "community",
];

/** Achievements gegroepeerd per categorie (in registry-volgorde). */
export function achievementsByCategory(): Record<AchievementCategory, AchievementDef[]> {
  const out = {
    training: [],
    consistency: [],
    strength: [],
    cardio: [],
    goals: [],
    community: [],
  } as Record<AchievementCategory, AchievementDef[]>;
  for (const a of ACHIEVEMENTS) out[a.category].push(a);
  return out;
}

/** Formatteer een metricwaarde voor weergave volgens de def-eenheid. */
export function formatMetricValue(def: AchievementDef, value: number): string {
  if (def.displayKm) return `${round(value / 1000, 1)} km`;
  if (def.displayHours) return `${round(value / 3600, 1)} uur`;
  const rounded = Math.round(value);
  return def.unit ? `${rounded.toLocaleString("nl-NL")} ${def.unit}` : String(rounded);
}

/** Voortgang 0..1 van een metricwaarde t.o.v. de drempel. */
export function progressOf(def: AchievementDef, value: number): number {
  if (def.threshold <= 0) return 1;
  return Math.max(0, Math.min(1, value / def.threshold));
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
