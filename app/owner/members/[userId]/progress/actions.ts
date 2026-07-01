"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { GoalMetric, MeasurementSource, PhotoPose, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { audit } from "@/lib/audit";
import { uploadProgressPhoto } from "@/lib/blob";
import { METRICS, GOAL_METRIC_KEY, GOAL_METRIC_LABEL, isMetricEnabled, type MetricKey } from "@/lib/measurement-meta";
import { getEnabledMeasurementKeys } from "@/lib/measurements";
import { evaluateAndAward } from "@/lib/achievements/evaluate";

export type MeasurementFormState = { error?: string };

const SOURCES: MeasurementSource[] = [
  "MANUAL", "INBODY", "TANITA", "EVOLT", "GARMIN", "APPLE_HEALTH", "GOOGLE_FIT",
];
const POSES: PhotoPose[] = ["FRONT", "SIDE", "BACK"];
const GOAL_METRICS: GoalMetric[] = ["WEIGHT", "BODY_FAT", "MUSCLE_MASS", "BMI", "WAIST"];

async function ensureMember(tenantId: string, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, tenantId, role: "TENANT_MEMBER" },
    select: { id: true, name: true, email: true },
  });
}

/** Parse één numeriek veld uit de FormData (komma→punt, leeg→null). */
function num(formData: FormData, key: string, integer: boolean): number | null {
  const raw = String(formData.get(key) ?? "").trim().replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return integer ? Math.round(n) : n;
}

/**
 * Bouw de meetwaarde-kolommen uit de FormData (één bron: METRICS). Alleen de door
 * de owner ingeschakelde velden worden meegenomen (`enabled = null` = alle) —
 * autoritatief: uitgeschakelde velden worden nooit geschreven, zodat bestaande
 * waarden bij een update behouden blijven en de client niet vertrouwd hoeft te
 * worden.
 */
function buildMetricData(
  formData: FormData,
  enabled: MetricKey[] | null
): Record<string, number | null> {
  const data: Record<string, number | null> = {};
  for (const def of METRICS) {
    if (!isMetricEnabled(def.key, enabled)) continue;
    data[def.key] = num(formData, def.key, def.integer ?? false);
  }
  return data;
}

async function uploadPhotos(
  formData: FormData,
  tenantSlug: string
): Promise<{ pose: PhotoPose; url: string }[]> {
  const out: { pose: PhotoPose; url: string }[] = [];
  for (const pose of POSES) {
    const file = formData.get(`photo_${pose}`);
    if (file instanceof File && file.size > 0) {
      const url = await uploadProgressPhoto(file, tenantSlug);
      if (url) out.push({ pose, url });
    }
  }
  return out;
}

function parseKeptPhotos(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseBasics(formData: FormData): { measuredAt: Date; source: MeasurementSource; notes: string | null } | null {
  const raw = String(formData.get("measuredAt") ?? "");
  const measuredAt = raw ? new Date(raw) : new Date();
  if (Number.isNaN(measuredAt.getTime())) return null;
  const sourceRaw = String(formData.get("source") ?? "MANUAL") as MeasurementSource;
  const source = SOURCES.includes(sourceRaw) ? sourceRaw : "MANUAL";
  const notes = String(formData.get("notes") ?? "").trim() || null;
  return { measuredAt, source, notes };
}

/** Nieuwe meting voor een lid. */
export async function createMeasurement(
  userId: string,
  _prev: MeasurementFormState,
  formData: FormData
): Promise<MeasurementFormState> {
  const owner = await requirePermission("measurements:manage");
  const member = await ensureMember(owner.tenantId, userId);
  if (!member) return { error: "Lid niet gevonden" };

  const basics = parseBasics(formData);
  if (!basics) return { error: "Ongeldige meetdatum" };

  const tenant = await prisma.tenant.findUnique({
    where: { id: owner.tenantId },
    select: { slug: true },
  });
  const photos = tenant ? await uploadPhotos(formData, tenant.slug) : [];
  const enabled = await getEnabledMeasurementKeys(owner.tenantId);

  const created = await prisma.measurement.create({
    data: {
      tenantId: owner.tenantId,
      userId,
      recordedById: owner.id,
      measuredAt: basics.measuredAt,
      source: basics.source,
      notes: basics.notes,
      ...buildMetricData(formData, enabled),
      photos: {
        create: photos.map((p) => ({ tenantId: owner.tenantId, pose: p.pose, url: p.url })),
      },
    },
  });

  await audit("measurement.add", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "Measurement",
    targetId: created.id,
    metadata: { member: member.name ?? member.email },
  });

  await evaluateAndAward(userId, owner.tenantId, { actor: owner });

  revalidatePath(`/owner/members/${userId}/progress`);
  revalidatePath("/member/progress");
  redirect(`/owner/members/${userId}/progress`);
}

/** Bestaande meting bijwerken. */
export async function updateMeasurement(
  userId: string,
  measurementId: string,
  _prev: MeasurementFormState,
  formData: FormData
): Promise<MeasurementFormState> {
  const owner = await requirePermission("measurements:manage");
  const existing = await prisma.measurement.findFirst({
    where: { id: measurementId, tenantId: owner.tenantId, userId },
    select: { id: true },
  });
  if (!existing) return { error: "Meting niet gevonden" };

  const basics = parseBasics(formData);
  if (!basics) return { error: "Ongeldige meetdatum" };

  const tenant = await prisma.tenant.findUnique({
    where: { id: owner.tenantId },
    select: { slug: true },
  });

  // Foto's: behoud de aangevinkte bestaande + voeg nieuwe toe; verwijder de rest.
  const kept = parseKeptPhotos(formData.get("existingPhotos"));
  await prisma.measurementPhoto.deleteMany({
    where: {
      measurementId,
      tenantId: owner.tenantId,
      id: { notIn: kept.length ? kept : ["__none__"] },
    },
  });
  const photos = tenant ? await uploadPhotos(formData, tenant.slug) : [];
  const enabled = await getEnabledMeasurementKeys(owner.tenantId);

  await prisma.measurement.update({
    where: { id: measurementId },
    data: {
      measuredAt: basics.measuredAt,
      source: basics.source,
      notes: basics.notes,
      ...buildMetricData(formData, enabled),
      photos: {
        create: photos.map((p) => ({ tenantId: owner.tenantId, pose: p.pose, url: p.url })),
      },
    },
  });

  await audit("measurement.update", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "Measurement",
    targetId: measurementId,
  });

  await evaluateAndAward(userId, owner.tenantId, { actor: owner });

  revalidatePath(`/owner/members/${userId}/progress`);
  revalidatePath("/member/progress");
  redirect(`/owner/members/${userId}/progress`);
}

/** Meting verwijderen. */
export async function deleteMeasurement(formData: FormData) {
  const owner = await requirePermission("measurements:manage");
  const userId = String(formData.get("userId") ?? "");
  const measurementId = String(formData.get("measurementId") ?? "");
  if (!userId || !measurementId) return;

  const res = await prisma.measurement.deleteMany({
    where: { id: measurementId, tenantId: owner.tenantId, userId },
  });
  if (res.count > 0) {
    await audit("measurement.remove", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "Measurement",
      targetId: measurementId,
    });
  }
  revalidatePath(`/owner/members/${userId}/progress`);
  revalidatePath("/member/progress");
  redirect(`/owner/members/${userId}/progress`);
}

/** Doel instellen/bijwerken (startwaarde = huidige laatste meetwaarde). */
export async function setGoal(formData: FormData) {
  const owner = await requirePermission("measurements:manage");
  const userId = String(formData.get("userId") ?? "");
  const metricRaw = String(formData.get("metric") ?? "") as GoalMetric;
  const targetRaw = String(formData.get("targetValue") ?? "").trim().replace(",", ".");
  const targetDateRaw = String(formData.get("targetDate") ?? "");
  if (!userId || !GOAL_METRICS.includes(metricRaw)) return;
  const targetValue = Number(targetRaw);
  if (!Number.isFinite(targetValue) || targetValue <= 0) return;

  const member = await ensureMember(owner.tenantId, userId);
  if (!member) return;

  // Startwaarde = huidige laatste meetwaarde van deze metric (voor voortgang).
  const latest = await prisma.measurement.findFirst({
    where: { tenantId: owner.tenantId, userId },
    orderBy: { measuredAt: "desc" },
  });
  const key = GOAL_METRIC_KEY[metricRaw];
  const startValue = latest ? ((latest[key] as number | null) ?? null) : null;

  await prisma.memberGoal.create({
    data: {
      tenantId: owner.tenantId,
      userId,
      metric: metricRaw,
      startValue,
      targetValue,
      targetDate: targetDateRaw ? new Date(targetDateRaw) : null,
      createdById: owner.id,
    } satisfies Prisma.MemberGoalUncheckedCreateInput,
  });

  await audit("goal.set", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "MemberGoal",
    metadata: { member: member.name ?? member.email, metric: GOAL_METRIC_LABEL[metricRaw] },
  });

  await evaluateAndAward(userId, owner.tenantId, { actor: owner });

  revalidatePath(`/owner/members/${userId}/progress`);
  revalidatePath("/member/progress");
}

/** Doel verwijderen. */
export async function deleteGoal(formData: FormData) {
  const owner = await requirePermission("measurements:manage");
  const userId = String(formData.get("userId") ?? "");
  const goalId = String(formData.get("goalId") ?? "");
  if (!goalId) return;

  const res = await prisma.memberGoal.deleteMany({
    where: { id: goalId, tenantId: owner.tenantId },
  });
  if (res.count > 0) {
    await audit("goal.remove", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "MemberGoal",
      targetId: goalId,
    });
  }
  revalidatePath(`/owner/members/${userId}/progress`);
  revalidatePath("/member/progress");
}
