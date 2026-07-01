import type { GoalMetric } from "@prisma/client";

/**
 * Gedeelde (client + server) metadata voor de Body Composition-module. Eén bron
 * van waarheid voor meetbare metrics, omtrekvelden, doel-mapping en periodes —
 * zo is "extra meetwaarde toevoegen" één regel. Bewust géén `server-only`.
 */

export type MetricKey =
  // Lichaamssamenstelling
  | "weightKg"
  | "bodyFatPct"
  | "muscleMassKg"
  | "fatMassKg"
  | "bmi"
  | "waterPct"
  | "boneMassKg"
  | "visceralFat"
  | "bmr"
  | "metabolicAge"
  // Omtrek (cm)
  | "chestCm"
  | "waistCm"
  | "hipsCm"
  | "neckCm"
  | "armLeftCm"
  | "armRightCm"
  | "thighLeftCm"
  | "thighRightCm"
  | "calfLeftCm"
  | "calfRightCm"
  // Conditie (fitness)
  | "restingHrBpm";

export type MetricGroup = "composition" | "circumference" | "condition";

export type MetricDef = {
  key: MetricKey;
  label: string;
  unit: string;
  group: MetricGroup;
  /**
   * Typische gezondheids-/fitnessrichting van een metric — puur een *hint*.
   * De delta-kleur in de UI is doel-relatief (t.o.v. het persoonlijke doel van
   * de sporter), niet o.b.v. een universele aanname over wat "beter" is. Zo
   * legt de app geen doel op: afvallen, aankomen of behouden is allemaal geldig.
   */
  goodDirection: "up" | "down" | "neutral";
  decimals: number;
  /** Geheel getal (geen decimalen, INT-kolom). */
  integer?: boolean;
  /** Headline-metric (delta-widgets + grafiek-snelkeuze). */
  primary?: boolean;
};

export const METRICS: MetricDef[] = [
  { key: "weightKg", label: "Gewicht", unit: "kg", group: "composition", goodDirection: "neutral", decimals: 1, primary: true },
  { key: "bodyFatPct", label: "Vetpercentage", unit: "%", group: "composition", goodDirection: "down", decimals: 1, primary: true },
  { key: "muscleMassKg", label: "Spiermassa", unit: "kg", group: "composition", goodDirection: "up", decimals: 1, primary: true },
  { key: "bmi", label: "BMI", unit: "", group: "composition", goodDirection: "neutral", decimals: 1, primary: true },
  { key: "waistCm", label: "Taille", unit: "cm", group: "circumference", goodDirection: "down", decimals: 1, primary: true },
  { key: "fatMassKg", label: "Vetmassa", unit: "kg", group: "composition", goodDirection: "down", decimals: 1 },
  { key: "waterPct", label: "Vochtpercentage", unit: "%", group: "composition", goodDirection: "up", decimals: 1 },
  { key: "boneMassKg", label: "Botmassa", unit: "kg", group: "composition", goodDirection: "up", decimals: 1 },
  { key: "visceralFat", label: "Visceraal vet", unit: "", group: "composition", goodDirection: "down", decimals: 0, integer: true },
  { key: "bmr", label: "BMR", unit: "kcal", group: "composition", goodDirection: "neutral", decimals: 0, integer: true },
  { key: "metabolicAge", label: "Metabole leeftijd", unit: "jr", group: "composition", goodDirection: "down", decimals: 0, integer: true },
  { key: "chestCm", label: "Borst", unit: "cm", group: "circumference", goodDirection: "neutral", decimals: 1 },
  { key: "hipsCm", label: "Heupen", unit: "cm", group: "circumference", goodDirection: "neutral", decimals: 1 },
  { key: "neckCm", label: "Nek", unit: "cm", group: "circumference", goodDirection: "neutral", decimals: 1 },
  { key: "armLeftCm", label: "Bovenarm links", unit: "cm", group: "circumference", goodDirection: "neutral", decimals: 1 },
  { key: "armRightCm", label: "Bovenarm rechts", unit: "cm", group: "circumference", goodDirection: "neutral", decimals: 1 },
  { key: "thighLeftCm", label: "Bovenbeen links", unit: "cm", group: "circumference", goodDirection: "neutral", decimals: 1 },
  { key: "thighRightCm", label: "Bovenbeen rechts", unit: "cm", group: "circumference", goodDirection: "neutral", decimals: 1 },
  { key: "calfLeftCm", label: "Kuit links", unit: "cm", group: "circumference", goodDirection: "neutral", decimals: 1 },
  { key: "calfRightCm", label: "Kuit rechts", unit: "cm", group: "circumference", goodDirection: "neutral", decimals: 1 },
  // Conditie (fitness) — een lagere rusthartslag duidt doorgaans op een betere conditie.
  { key: "restingHrBpm", label: "Rusthartslag", unit: "bpm", group: "condition", goodDirection: "down", decimals: 0, integer: true, primary: true },
];

export const METRIC_BY_KEY: Record<MetricKey, MetricDef> = Object.fromEntries(
  METRICS.map((m) => [m.key, m])
) as Record<MetricKey, MetricDef>;

export const COMPOSITION_METRICS = METRICS.filter((m) => m.group === "composition");
export const CIRCUMFERENCE_METRICS = METRICS.filter((m) => m.group === "circumference");
export const CONDITION_METRICS = METRICS.filter((m) => m.group === "condition");
export const PRIMARY_METRICS = METRICS.filter((m) => m.primary);

/** Alle geldige metric-keys (voor validatie van een tenant-selectie). */
export const ALL_METRIC_KEYS: MetricKey[] = METRICS.map((m) => m.key);

/**
 * De door de owner geselecteerde meetvelden (`Tenant.enabledMeasurementFields`,
 * JSON). Retour een set gevalideerde keys, of **`null` = alle velden actief**
 * (nooit geconfigureerd → backward-compat). Een lege selectie ([]) betekent
 * bewust "geen enkel veld".
 */
export function parseEnabledMetricKeys(value: unknown): MetricKey[] | null {
  if (!Array.isArray(value)) return null;
  const valid = new Set<string>(ALL_METRIC_KEYS);
  return value.filter((k): k is MetricKey => typeof k === "string" && valid.has(k));
}

/** Is een specifieke metric ingeschakeld? (`null` = alles). */
export function isMetricEnabled(key: MetricKey, enabled: MetricKey[] | null): boolean {
  return enabled == null || enabled.includes(key);
}

/** Filtert een metric-lijst op de ingeschakelde selectie (`null` = alles). */
export function filterEnabledMetrics(
  metrics: MetricDef[],
  enabled: MetricKey[] | null
): MetricDef[] {
  if (enabled == null) return metrics;
  const set = new Set(enabled);
  return metrics.filter((m) => set.has(m.key));
}

/** Welke Measurement-kolom hoort bij een doel-metric. */
export const GOAL_METRIC_KEY: Record<GoalMetric, MetricKey> = {
  WEIGHT: "weightKg",
  BODY_FAT: "bodyFatPct",
  MUSCLE_MASS: "muscleMassKg",
  BMI: "bmi",
  WAIST: "waistCm",
};

export const GOAL_METRIC_LABEL: Record<GoalMetric, string> = {
  WEIGHT: "Gewicht",
  BODY_FAT: "Vetpercentage",
  MUSCLE_MASS: "Spiermassa",
  BMI: "BMI",
  WAIST: "Tailleomtrek",
};

export const GOAL_METRICS: GoalMetric[] = ["WEIGHT", "BODY_FAT", "MUSCLE_MASS", "BMI", "WAIST"];

export type RangeKey = "30d" | "90d" | "6m" | "1y" | "all";

export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "30d", label: "30 dagen", days: 30 },
  { key: "90d", label: "90 dagen", days: 90 },
  { key: "6m", label: "6 maanden", days: 182 },
  { key: "1y", label: "1 jaar", days: 365 },
  { key: "all", label: "Alles", days: null },
];

export const MEASUREMENT_SOURCE_LABEL: Record<string, string> = {
  MANUAL: "Handmatig",
  INBODY: "InBody",
  TANITA: "Tanita",
  EVOLT: "Evolt",
  GARMIN: "Garmin",
  APPLE_HEALTH: "Apple Health",
  GOOGLE_FIT: "Google Fit",
};

export const POSE_LABEL: Record<string, string> = {
  FRONT: "Voorkant",
  SIDE: "Zijkant",
  BACK: "Achterkant",
};

/** Formatteert een metric-waarde met het juiste aantal decimalen + eenheid. */
export function formatMetric(key: MetricKey, value: number | null | undefined): string {
  if (value == null) return "—";
  const def = METRIC_BY_KEY[key];
  const num = def.integer ? Math.round(value) : Number(value.toFixed(def.decimals));
  const formatted = num.toLocaleString("nl-NL", {
    minimumFractionDigits: def.integer ? 0 : def.decimals,
    maximumFractionDigits: def.integer ? 0 : def.decimals,
  });
  return def.unit ? `${formatted} ${def.unit}` : formatted;
}
