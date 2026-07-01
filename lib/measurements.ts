import "server-only";
import type { Measurement, MeasurementSource, PhotoPose, GoalMetric } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  METRICS,
  PRIMARY_METRICS,
  GOAL_METRIC_KEY,
  RANGES,
  parseEnabledMetricKeys,
  type MetricKey,
  type RangeKey,
} from "@/lib/measurement-meta";

/**
 * De door de owner geselecteerde meetvelden voor deze tenant (`null` = alle
 * velden actief). Eén plek zodat pagina's + server-actions dezelfde selectie
 * gebruiken (weergave én autoritatieve validatie).
 */
export async function getEnabledMeasurementKeys(
  tenantId: string
): Promise<MetricKey[] | null> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { enabledMeasurementFields: true },
  });
  return parseEnabledMetricKeys(t?.enabledMeasurementFields);
}

export type MeasurementValues = Record<MetricKey, number | null>;

export type MeasurementPhotoRow = { id: string; pose: PhotoPose; url: string };

export type MeasurementRow = {
  id: string;
  measuredAt: string; // ISO
  notes: string | null;
  source: MeasurementSource;
  recordedById: string | null;
  recordedByName: string | null;
  values: MeasurementValues;
  photos: MeasurementPhotoRow[];
};

type MetricColumns = Pick<Measurement, MetricKey>;

function extractValues(m: MetricColumns): MeasurementValues {
  const out = {} as MeasurementValues;
  for (const def of METRICS) {
    const raw = m[def.key];
    out[def.key] = typeof raw === "number" ? raw : null;
  }
  return out;
}

/** Trainer-namen (recordedById → naam) in één batch (geen FK op het veld). */
async function recordedByNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.name ?? u.email]));
}

function toRow(
  m: Measurement & { photos: { id: string; pose: PhotoPose; url: string }[] },
  names: Map<string, string>
): MeasurementRow {
  return {
    id: m.id,
    measuredAt: m.measuredAt.toISOString(),
    notes: m.notes,
    source: m.source,
    recordedById: m.recordedById,
    recordedByName: m.recordedById ? names.get(m.recordedById) ?? null : null,
    values: extractValues(m),
    photos: m.photos
      .slice()
      .sort((a, b) => a.pose.localeCompare(b.pose))
      .map((p) => ({ id: p.id, pose: p.pose, url: p.url })),
  };
}

/** Alle metingen van een lid (nieuwste eerst), incl. foto's + trainer-naam. */
export async function listMeasurements(
  tenantId: string,
  userId: string
): Promise<MeasurementRow[]> {
  const rows = await prisma.measurement.findMany({
    where: { tenantId, userId },
    orderBy: { measuredAt: "desc" },
    include: { photos: true },
  });
  const names = await recordedByNames(rows.map((r) => r.recordedById));
  return rows.map((r) => toRow(r, names));
}

/** Eén meting (tenant-gescoped). */
export async function getMeasurement(
  tenantId: string,
  id: string,
  userId?: string
): Promise<MeasurementRow | null> {
  const m = await prisma.measurement.findFirst({
    where: { id, tenantId, ...(userId ? { userId } : {}) },
    include: { photos: true },
  });
  if (!m) return null;
  const names = await recordedByNames([m.recordedById]);
  return toRow(m, names);
}

export type DeltaItem = {
  key: MetricKey;
  label: string;
  unit: string;
  current: number | null;
  delta: number | null;
  /**
   * Goed (groen), slecht (rood) of neutraal. Bewust **doel-relatief**: alleen
   * gekleurd als de sporter een persoonlijk doel voor deze metric heeft en er
   * naartoe/vanaf beweegt. Zonder doel is elke verandering neutraal — de app
   * bestempelt aankomen/afvallen/behouden niet als "goed" of "slecht".
   */
  tone: "good" | "bad" | "neutral";
};

/** Verschil tussen de laatste en de voorlaatste meting, per headline-metric. */
export async function getDeltas(tenantId: string, userId: string): Promise<DeltaItem[]> {
  const [measurements, goals] = await Promise.all([
    prisma.measurement.findMany({
      where: { tenantId, userId },
      orderBy: { measuredAt: "desc" },
      take: 10,
    }),
    prisma.memberGoal.findMany({
      where: { tenantId, userId, achievedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  // Alleen metingen met minstens één numerieke waarde tellen mee (een louter
  // foto-upload door het lid mag de headline-delta's niet resetten).
  const withValues = measurements.filter((m) =>
    METRICS.some((d) => (m[d.key] as number | null) != null)
  );
  const [latest, previous] = withValues;
  if (!latest) return [];

  // Doel-target per metric-kolom (meest recente per metric).
  const targetByKey = new Map<MetricKey, number>();
  for (const g of goals) {
    const key = GOAL_METRIC_KEY[g.metric];
    if (!targetByKey.has(key)) targetByKey.set(key, g.targetValue);
  }

  return PRIMARY_METRICS.map((def) => {
    const cur = (latest[def.key] as number | null) ?? null;
    const prev = previous ? ((previous[def.key] as number | null) ?? null) : null;
    const delta = cur != null && prev != null ? Number((cur - prev).toFixed(2)) : null;
    let tone: DeltaItem["tone"] = "neutral";
    const target = targetByKey.get(def.key);
    // Kleur alléén relatief aan het persoonlijke doel van de sporter.
    if (target != null && delta != null && delta !== 0 && cur != null && prev != null) {
      const closer = Math.abs(cur - target) < Math.abs(prev - target);
      tone = closer ? "good" : "bad";
    }
    return { key: def.key, label: def.label, unit: def.unit, current: cur, delta, tone };
  });
}

export type SeriesPoint = { date: string; ts: number } & Partial<Record<MetricKey, number | null>>;

/** Tijdreeks (oplopend) binnen een periode — de grafiek kiest de metric. */
export async function getSeries(
  tenantId: string,
  userId: string,
  range: RangeKey
): Promise<SeriesPoint[]> {
  const days = RANGES.find((r) => r.key === range)?.days ?? null;
  const since = days ? new Date(Date.now() - days * 86400_000) : undefined;
  const rows = await prisma.measurement.findMany({
    where: { tenantId, userId, ...(since ? { measuredAt: { gte: since } } : {}) },
    orderBy: { measuredAt: "asc" },
  });
  return rows.map((m) => {
    const point: SeriesPoint = {
      date: m.measuredAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
      ts: m.measuredAt.getTime(),
    };
    for (const def of METRICS) point[def.key] = (m[def.key] as number | null) ?? null;
    return point;
  });
}

export type GoalProgress = {
  id: string;
  metric: GoalMetric;
  metricKey: MetricKey;
  startValue: number | null;
  targetValue: number;
  current: number | null;
  /** 0–100, of null als niet te berekenen. */
  percent: number | null;
  targetDate: string | null;
  achieved: boolean;
};

/** Actieve doelen (meest recente per metric) met huidige waarde + voortgang. */
export async function getGoals(tenantId: string, userId: string): Promise<GoalProgress[]> {
  const [goals, latest] = await Promise.all([
    prisma.memberGoal.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.measurement.findFirst({
      where: { tenantId, userId },
      orderBy: { measuredAt: "desc" },
    }),
  ]);

  const seen = new Set<GoalMetric>();
  const result: GoalProgress[] = [];
  for (const g of goals) {
    if (seen.has(g.metric)) continue; // alleen het meest recente doel per metric
    seen.add(g.metric);
    const key = GOAL_METRIC_KEY[g.metric];
    const current = latest ? ((latest[key] as number | null) ?? null) : null;
    let percent: number | null = null;
    if (current != null && g.startValue != null && g.targetValue !== g.startValue) {
      const raw = (current - g.startValue) / (g.targetValue - g.startValue);
      percent = Math.round(Math.max(0, Math.min(1, raw)) * 100);
    }
    result.push({
      id: g.id,
      metric: g.metric,
      metricKey: key,
      startValue: g.startValue,
      targetValue: g.targetValue,
      current,
      percent,
      targetDate: g.targetDate ? g.targetDate.toISOString() : null,
      achieved: g.achievedAt != null || (percent != null && percent >= 100),
    });
  }
  return result;
}
