"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { requireOwner } from "@/lib/owner";
import { requireFeature } from "@/lib/features/service";
import { getLocationScope } from "@/lib/location-access";
import { getScopedDefect, hasOtherOpenUnsafe } from "@/lib/defects-server";
import { OPEN_DEFECT_STATUSES } from "@/lib/defects";
import { notifyReporterResolved } from "@/lib/defects/notify";
import { audit } from "@/lib/audit";
import { firstValidationError } from "@/lib/validation-message";
import type { TenantUser } from "@/lib/staff";

export type DefectActionState = { error?: string; ok?: boolean };

function revalidate() {
  revalidatePath("/owner/defects");
  revalidatePath("/member/defects");
}

/**
 * Melding laden binnen tenant + vestiging-scope. Buiten de scope of tenant →
 * 404 (géén 403): een melding van een andere vestiging "bestaat niet".
 */
async function loadDefectOr404(id: string, user: TenantUser) {
  const scope = await getLocationScope(user);
  const defect = await getScopedDefect(id, user.tenantId, scope);
  if (!defect) notFound();
  return defect;
}

async function guard(): Promise<TenantUser> {
  const user = await requirePermission("defects:manage");
  await requireFeature(user.tenantId, "defects");
  return user;
}

// --- Bevestigen (gezien) ------------------------------------------------------

export async function acknowledgeDefect(formData: FormData): Promise<void> {
  const user = await guard();
  const defect = await loadDefectOr404(String(formData.get("defectId") ?? ""), user);
  if (defect.status !== "OPEN") return;

  await prisma.equipmentDefect.update({
    where: { id: defect.id },
    data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
  });
  await audit("defect.acknowledge", {
    actor: user,
    tenantId: user.tenantId,
    locationId: defect.locationId,
    targetType: "EquipmentDefect",
    targetId: defect.id,
    metadata: { machine: defect.machineLabel },
  });
  revalidate();
}

// --- Toewijzen ------------------------------------------------------------------

export async function assignDefect(formData: FormData): Promise<void> {
  const user = await guard();
  const defect = await loadDefectOr404(String(formData.get("defectId") ?? ""), user);
  const assigneeId = String(formData.get("assigneeId") ?? "");

  let assignee: { id: string; name: string | null; email: string } | null = null;
  if (assigneeId) {
    assignee = await prisma.user.findFirst({
      where: {
        id: assigneeId,
        tenantId: user.tenantId,
        active: true,
        role: { in: ["TENANT_ADMIN", "TENANT_STAFF"] },
      },
      select: { id: true, name: true, email: true },
    });
    if (!assignee) return;
  }

  await prisma.equipmentDefect.update({
    where: { id: defect.id },
    data: { assignedToId: assignee?.id ?? null },
  });
  await audit("defect.assign", {
    actor: user,
    tenantId: user.tenantId,
    locationId: defect.locationId,
    targetType: "EquipmentDefect",
    targetId: defect.id,
    metadata: {
      machine: defect.machineLabel,
      assignee: assignee?.name ?? assignee?.email ?? "niemand",
    },
  });
  revalidate();
}

// --- In reparatie ----------------------------------------------------------------

export async function startRepair(formData: FormData): Promise<void> {
  const user = await guard();
  const defect = await loadDefectOr404(String(formData.get("defectId") ?? ""), user);
  if (!(OPEN_DEFECT_STATUSES as readonly string[]).includes(defect.status)) return;

  await prisma.equipmentDefect.update({
    where: { id: defect.id },
    data: {
      status: "IN_REPAIR",
      acknowledgedAt: defect.acknowledgedAt ?? new Date(),
    },
  });
  await audit("defect.status.change", {
    actor: user,
    tenantId: user.tenantId,
    locationId: defect.locationId,
    targetType: "EquipmentDefect",
    targetId: defect.id,
    oldValue: { status: defect.status },
    newValue: { status: "IN_REPAIR" },
    metadata: { machine: defect.machineLabel, status: "IN_REPAIR" },
  });
  revalidate();
}

// --- Oplossen (met verplichte notitie) + optioneel vrijgeven ----------------------

const resolveSchema = z.object({
  defectId: z.string().min(1),
  resolutionNote: z.string().trim().min(3, "noteRequired").max(2000),
  release: z.boolean(),
});

/**
 * Apparaat vrijgeven als dat kan: alleen wanneer het apparaat buiten gebruik
 * staat én er geen ándere open UNSAFE-melding op ligt. Retourneert of er is
 * vrijgegeven.
 */
async function maybeReleaseMachine(
  user: TenantUser,
  defect: { id: string; machineId: string | null; machineLabel: string | null }
): Promise<boolean> {
  if (!defect.machineId) return false;
  const machine = await prisma.machine.findFirst({
    where: { id: defect.machineId, tenantId: user.tenantId },
    select: { id: true, name: true, status: true },
  });
  if (!machine || machine.status !== "OUT_OF_SERVICE") return false;
  if (await hasOtherOpenUnsafe(user.tenantId, machine.id, defect.id)) return false;

  await prisma.machine.update({
    where: { id: machine.id },
    data: { status: "ACTIVE" },
  });
  await audit("machine.status.change", {
    actor: user,
    tenantId: user.tenantId,
    targetType: "Machine",
    targetId: machine.id,
    oldValue: { status: machine.status },
    newValue: { status: "ACTIVE" },
    metadata: { name: machine.name, reason: "defect.resolved", defectId: defect.id },
  });
  return true;
}

export async function resolveDefect(
  _prev: DefectActionState,
  formData: FormData
): Promise<DefectActionState> {
  const user = await guard();
  const parsed = resolveSchema.safeParse({
    defectId: formData.get("defectId"),
    resolutionNote: formData.get("resolutionNote"),
    release: formData.get("release") === "1",
  });
  if (!parsed.success) return { error: await firstValidationError(parsed.error) };

  const defect = await loadDefectOr404(parsed.data.defectId, user);
  if (defect.status === "RESOLVED" || defect.status === "REJECTED") return { ok: true };

  await prisma.equipmentDefect.update({
    where: { id: defect.id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedById: user.id,
      resolutionNote: parsed.data.resolutionNote,
      acknowledgedAt: defect.acknowledgedAt ?? new Date(),
    },
  });

  const released = parsed.data.release
    ? await maybeReleaseMachine(user, defect)
    : false;

  await audit("defect.resolve", {
    actor: user,
    tenantId: user.tenantId,
    locationId: defect.locationId,
    targetType: "EquipmentDefect",
    targetId: defect.id,
    metadata: { machine: defect.machineLabel, released: String(released) },
  });

  // Kort bericht aan de melder (alleen niet-anoniem) — best-effort.
  if (defect.reportedById) {
    await notifyReporterResolved({
      tenantId: user.tenantId,
      reporterId: defect.reportedById,
      machineLabel: defect.machineLabel ?? "apparaat",
    });
  }

  revalidate();
  return { ok: true };
}

// --- Afwijzen ---------------------------------------------------------------------

const rejectSchema = z.object({
  defectId: z.string().min(1),
  resolutionNote: z.string().trim().max(2000).optional(),
  release: z.boolean(),
});

export async function rejectDefect(
  _prev: DefectActionState,
  formData: FormData
): Promise<DefectActionState> {
  const user = await guard();
  const parsed = rejectSchema.safeParse({
    defectId: formData.get("defectId"),
    resolutionNote: String(formData.get("resolutionNote") ?? "") || undefined,
    release: formData.get("release") === "1",
  });
  if (!parsed.success) return { error: await firstValidationError(parsed.error) };

  const defect = await loadDefectOr404(parsed.data.defectId, user);
  if (defect.status === "RESOLVED" || defect.status === "REJECTED") return { ok: true };

  await prisma.equipmentDefect.update({
    where: { id: defect.id },
    data: {
      status: "REJECTED",
      resolvedAt: new Date(),
      resolvedById: user.id,
      resolutionNote: parsed.data.resolutionNote ?? null,
    },
  });
  // Vals alarm op een geblokkeerd apparaat → desgewenst meteen vrijgeven.
  const released = parsed.data.release
    ? await maybeReleaseMachine(user, defect)
    : false;

  await audit("defect.reject", {
    actor: user,
    tenantId: user.tenantId,
    locationId: defect.locationId,
    targetType: "EquipmentDefect",
    targetId: defect.id,
    metadata: { machine: defect.machineLabel, released: String(released) },
  });
  revalidate();
  return { ok: true };
}

// --- Samenvoegen als duplicaat -----------------------------------------------------

export async function mergeDefect(formData: FormData): Promise<void> {
  const user = await guard();
  const defect = await loadDefectOr404(String(formData.get("defectId") ?? ""), user);
  const targetId = String(formData.get("targetId") ?? "");
  if (!targetId || targetId === defect.id) return;

  // Doelmelding moet in dezelfde tenant + scope bestaan (anders 404).
  const target = await loadDefectOr404(targetId, user);

  await prisma.equipmentDefect.update({
    where: { id: defect.id },
    data: {
      status: "REJECTED",
      duplicateOfId: target.id,
      resolvedAt: new Date(),
      resolvedById: user.id,
    },
  });
  await audit("defect.merge", {
    actor: user,
    tenantId: user.tenantId,
    locationId: defect.locationId,
    targetType: "EquipmentDefect",
    targetId: defect.id,
    metadata: { machine: defect.machineLabel, duplicateOf: target.id },
  });
  revalidate();
}

// --- Interne notitie ---------------------------------------------------------------

export async function saveInternalNote(formData: FormData): Promise<void> {
  const user = await guard();
  const defect = await loadDefectOr404(String(formData.get("defectId") ?? ""), user);
  const note = String(formData.get("internalNote") ?? "").trim();
  await prisma.equipmentDefect.update({
    where: { id: defect.id },
    data: { internalNote: note || null },
  });
  revalidate();
}

// --- Verwijderen (alleen eigenaar) ---------------------------------------------------

export async function deleteDefect(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  await requireFeature(owner.tenantId, "defects");
  const defect = await prisma.equipmentDefect.findFirst({
    where: { id: String(formData.get("defectId") ?? ""), tenantId: owner.tenantId },
    select: { id: true, machineLabel: true, locationId: true },
  });
  if (!defect) notFound();

  await prisma.equipmentDefect.delete({ where: { id: defect.id } });
  await audit("defect.delete", {
    actor: owner,
    tenantId: owner.tenantId,
    locationId: defect.locationId,
    targetType: "EquipmentDefect",
    targetId: defect.id,
    metadata: { machine: defect.machineLabel },
  });
  revalidate();
}

// --- Achterstand-termijn (alleen eigenaar, /owner/settings) --------------------------

const reminderSchema = z.object({
  days: z.coerce.number().int().min(1).max(90),
});

export async function setDefectReminderDays(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const parsed = reminderSchema.safeParse({ days: formData.get("days") });
  if (!parsed.success) return;

  await prisma.tenant.update({
    where: { id: owner.tenantId },
    data: { defectReminderDays: parsed.data.days },
  });
  revalidatePath("/owner/settings");
  revalidatePath("/owner/defects");
}
