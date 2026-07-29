"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { requireFeature } from "@/lib/features/service";
import { audit } from "@/lib/audit";
import { uploadDefectPhoto } from "@/lib/blob";
import { resolveActiveLocationId } from "@/lib/location-resolve";
import {
  DEFECT_SYMPTOM_KEYS,
  DEFECT_DAILY_LIMIT,
  DEFECT_MAX_PHOTOS,
  CONFIRM_BUMP_THRESHOLD,
  OPEN_DEFECT_STATUSES,
  bumpSeverity,
  defectSymptomLabel,
} from "@/lib/defects";
import { getOpenDefectsForMachineQuery } from "@/lib/defects-server";
import { notifyDefectEvent } from "@/lib/defects/notify";
import { firstValidationError } from "@/lib/validation-message";

export type DefectSubmitState = {
  error?: string;
  /** Te veel meldingen vandaag (aparte melding in de UI). */
  rateLimited?: boolean;
  ok?: boolean;
};

const submitSchema = z
  .object({
    machineId: z.string().trim().optional(),
    machineLabel: z.string().trim().max(120).optional(),
    locationId: z.string().trim().optional(),
    symptom: z.enum(DEFECT_SYMPTOM_KEYS),
    description: z.string().trim().max(2000).optional(),
    unsafe: z.boolean(),
    anonymous: z.boolean(),
  })
  .refine((d) => d.machineId || (d.machineLabel && d.machineLabel.length >= 2), {
    message: "machineRequired",
    path: ["machineLabel"],
  });

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Defect melden aan de sportschool. Rate limit via DefectQuota (patroon
 * ReportQuota: de quota-rij draagt altijd de userId, óók bij anoniem — er is
 * geen koppeling naar wélke melding, dus de anonimiteit blijft). Bij een
 * UNSAFE-melding gaat het apparaat in dezélfde transactie buiten gebruik
 * (acceptatiecriterium 2).
 */
export async function submitDefect(
  _prev: DefectSubmitState,
  formData: FormData
): Promise<DefectSubmitState> {
  const user = await requireMember();
  await requireFeature(user.tenantId, "defects");

  const parsed = submitSchema.safeParse({
    machineId: String(formData.get("machineId") ?? "") || undefined,
    machineLabel: String(formData.get("machineLabel") ?? "") || undefined,
    locationId: String(formData.get("locationId") ?? "") || undefined,
    symptom: formData.get("symptom"),
    description: String(formData.get("description") ?? "") || undefined,
    unsafe: formData.get("unsafe") === "1",
    anonymous: formData.get("anonymous") === "1",
  });
  if (!parsed.success) return { error: await firstValidationError(parsed.error) };
  const input = parsed.data;

  // --- Daglimiet (kalenderdag) -------------------------------------------------
  const usedToday = await prisma.defectQuota.count({
    where: { userId: user.id, createdAt: { gte: startOfToday() } },
  });
  if (usedToday >= DEFECT_DAILY_LIMIT) return { rateLimited: true };

  // --- Apparaat + vestiging bepalen ---------------------------------------------
  // Mét apparaat: vestiging = vestiging van het apparaat (tenant-gevalideerd).
  // Zonder apparaat: actieve vestiging van het lid (cookie → thuis → default).
  let machine: { id: string; name: string; locationId: string; status: string } | null = null;
  if (input.machineId) {
    machine = await prisma.machine.findFirst({
      where: { id: input.machineId, tenantId: user.tenantId },
      select: { id: true, name: true, locationId: true, status: true },
    });
    if (!machine) return { error: "Apparaat niet gevonden" };
  }
  const locationId =
    machine?.locationId ??
    (await resolveActiveLocationId(user.tenantId, {
      requestedLocationId: input.locationId ?? null,
      homeLocationId:
        (
          await prisma.user.findUnique({
            where: { id: user.id },
            select: { homeLocationId: true },
          })
        )?.homeLocationId ?? null,
    }));

  // --- Foto's (max 2, optioneel; melding gaat door als upload niet kan) ---------
  const photoKeys: string[] = [];
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, DEFECT_MAX_PHOTOS);
  for (const file of files) {
    const url = await uploadDefectPhoto(file, user.tenantId);
    if (url) photoKeys.push(url);
  }

  const severity = input.unsafe ? "UNSAFE" : "MINOR";
  const anonymous = input.anonymous;

  // --- Aanmaken + (bij UNSAFE) apparaat blokkeren in één transactie -------------
  const [defect] = await prisma.$transaction([
    prisma.equipmentDefect.create({
      data: {
        tenantId: user.tenantId,
        locationId,
        machineId: machine?.id ?? null,
        machineLabel: machine?.name ?? input.machineLabel ?? null,
        reportedById: anonymous ? null : user.id, // criterium 6: anoniem = géén gebruikers-ID
        severity,
        symptom: input.symptom,
        description: input.description ?? null,
        photoKeys,
      },
      select: { id: true, machineLabel: true },
    }),
    // Quota-rij los van de melding (daglimiet geldt ook anoniem).
    prisma.defectQuota.create({ data: { tenantId: user.tenantId, userId: user.id } }),
    ...(input.unsafe && machine
      ? [
          prisma.machine.update({
            where: { id: machine.id },
            data: { status: "OUT_OF_SERVICE" },
          }),
        ]
      : []),
  ]);

  await audit("defect.create", {
    actor: anonymous
      ? { id: null, email: null, role: user.role }
      : { id: user.id, email: user.email, role: user.role },
    tenantId: user.tenantId,
    locationId,
    targetType: "EquipmentDefect",
    targetId: defect.id,
    metadata: {
      machine: defect.machineLabel,
      symptom: defectSymptomLabel(input.symptom),
      severity,
      anonymous,
      photos: photoKeys.length,
    },
  });
  if (input.unsafe && machine) {
    await audit("machine.status.change", {
      actor: { email: "systeem", role: null },
      tenantId: user.tenantId,
      locationId,
      targetType: "Machine",
      targetId: machine.id,
      oldValue: { status: machine.status },
      newValue: { status: "OUT_OF_SERVICE" },
      metadata: { name: machine.name, reason: "defect.unsafe", defectId: defect.id },
    });
  }

  // UNSAFE → direct naar de behandelaars van deze vestiging (best-effort).
  if (input.unsafe) {
    await notifyDefectEvent({
      tenantId: user.tenantId,
      defectId: defect.id,
      locationId,
      machineLabel: defect.machineLabel ?? "Onbekend apparaat",
      symptomLabel: defectSymptomLabel(input.symptom),
      event: "unsafe",
      detail: input.description ?? null,
    });
  }

  revalidatePath("/member/defects");
  revalidatePath("/owner/defects");
  return { ok: true };
}

export type DefectConfirmState = { error?: string; ok?: boolean };

/**
 * "Ik zie dit ook" op een bestaande open melding — in plaats van een duplicaat.
 * Vanaf CONFIRM_BUMP_THRESHOLD bevestigingen gaat de severity één stap omhoog
 * (nooit tot UNSAFE — criterium 4) en worden de behandelaars direct geïnformeerd.
 */
export async function confirmDefect(defectId: string): Promise<DefectConfirmState> {
  const user = await requireMember();
  await requireFeature(user.tenantId, "defects");

  const defect = await prisma.equipmentDefect.findFirst({
    where: {
      id: defectId,
      tenantId: user.tenantId, // criterium 5: nooit een melding van een andere gym
      status: { in: [...OPEN_DEFECT_STATUSES] },
    },
    select: {
      id: true,
      severity: true,
      symptom: true,
      machineLabel: true,
      locationId: true,
      reportedById: true,
    },
  });
  if (!defect) return { error: "not-found" };
  // Eigen melding bevestigen telt niet (zou de drempel kunstmatig verlagen).
  if (defect.reportedById === user.id) return { ok: true };

  await prisma.defectConfirmation.upsert({
    where: { defectId_userId: { defectId: defect.id, userId: user.id } },
    create: { tenantId: user.tenantId, defectId: defect.id, userId: user.id },
    update: {},
  });

  await audit("defect.confirm", {
    actor: user,
    tenantId: user.tenantId,
    locationId: defect.locationId,
    targetType: "EquipmentDefect",
    targetId: defect.id,
    metadata: { machine: defect.machineLabel },
  });

  // Automatische escalatie — precies één keer, op het moment van de drempel.
  const confirmations = await prisma.defectConfirmation.count({
    where: { defectId: defect.id },
  });
  if (confirmations === CONFIRM_BUMP_THRESHOLD) {
    const next = bumpSeverity(defect.severity);
    if (next !== defect.severity) {
      await prisma.equipmentDefect.update({
        where: { id: defect.id },
        data: { severity: next },
      });
      await audit("defect.status.change", {
        actor: { email: "systeem", role: null },
        tenantId: user.tenantId,
        locationId: defect.locationId,
        targetType: "EquipmentDefect",
        targetId: defect.id,
        oldValue: { severity: defect.severity },
        newValue: { severity: next },
        metadata: { machine: defect.machineLabel, status: next, confirmations },
      });
    }
    // ≥3 bevestigingen → direct melden (ook als de severity al MAJOR was).
    await notifyDefectEvent({
      tenantId: user.tenantId,
      defectId: defect.id,
      locationId: defect.locationId,
      machineLabel: defect.machineLabel ?? "Onbekend apparaat",
      symptomLabel: defectSymptomLabel(defect.symptom),
      event: "escalated",
    });
  }

  revalidatePath("/member/defects");
  revalidatePath("/owner/defects");
  return { ok: true };
}

export type OpenDefectSummary = {
  id: string;
  symptom: string;
  severity: string;
  createdAt: string;
  confirmations: number;
  /** Heeft dit lid de melding al bevestigd (of zelf gemeld)? */
  mine: boolean;
};

/**
 * Open meldingen voor een apparaat — voedt de duplicaatcheck in de meldstroom
 * ("iemand meldde dit al — ik zie dit ook"). Lid-veilig: geen melder-identiteit.
 */
export async function getOpenDefectsForMachine(
  machineId: string
): Promise<OpenDefectSummary[]> {
  const user = await requireMember();
  await requireFeature(user.tenantId, "defects");
  const [rows, mine] = await Promise.all([
    getOpenDefectsForMachineQuery(user.tenantId, machineId),
    prisma.defectConfirmation.findMany({
      where: { userId: user.id, defect: { tenantId: user.tenantId, machineId } },
      select: { defectId: true },
    }),
  ]);
  const mineIds = new Set(mine.map((m) => m.defectId));
  const own = await prisma.equipmentDefect.findMany({
    where: { tenantId: user.tenantId, machineId, reportedById: user.id },
    select: { id: true },
  });
  for (const o of own) mineIds.add(o.id);
  return rows.map((r) => ({
    id: r.id,
    symptom: r.symptom,
    severity: r.severity,
    createdAt: r.createdAt.toISOString(),
    confirmations: r._count.confirmations,
    mine: mineIds.has(r.id),
  }));
}
