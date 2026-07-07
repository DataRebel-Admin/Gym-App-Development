"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { MachineStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { requireFeature } from "@/lib/features/service";
import { audit } from "@/lib/audit";
import { computeNextMaintenance } from "@/lib/maintenance";
import { MACHINE_TYPES } from "@/lib/machine";
import {
  notifyMaintenanceEvent,
  notifyMaintenanceThresholds,
} from "@/lib/maintenance/notify";
import { firstValidationError } from "@/lib/validation-message";

export type MaintenanceActionState = { error?: string; ok?: boolean };

function revalidate(machineId?: string) {
  revalidatePath("/owner/maintenance");
  revalidatePath("/owner/machines");
  if (machineId) revalidatePath(`/owner/machines/${machineId}`);
}

/** Machine ophalen binnen de tenant (of null). */
async function loadMachine(id: string, tenantId: string) {
  return prisma.machine.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      name: true,
      status: true,
      usageCount: true,
      usageThreshold: true,
      maintenanceIntervalDays: true,
      lastMaintenanceAt: true,
    },
  });
}

// --- Onderhoudsregels instellen ---------------------------------------------

const rulesSchema = z.object({
  machineId: z.string().min(1),
  usageThreshold: z.coerce.number().int().min(0).max(1_000_000).optional().or(z.literal(0)),
  intervalDays: z.coerce.number().int().min(0).max(3650).optional().or(z.literal(0)),
});

export async function saveMaintenanceRules(
  _prev: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  const user = await requirePermission("maintenance:manage");
  await requireFeature(user.tenantId, "maintenance");
  const rawThreshold = formData.get("usageThreshold");
  const rawInterval = formData.get("intervalDays");
  const parsed = rulesSchema.safeParse({
    machineId: formData.get("machineId"),
    usageThreshold: rawThreshold ? Number(rawThreshold) : 0,
    intervalDays: rawInterval ? Number(rawInterval) : 0,
  });
  if (!parsed.success) return { error: await firstValidationError(parsed.error) };

  const machine = await loadMachine(parsed.data.machineId, user.tenantId);
  if (!machine) return { error: "Machine niet gevonden" };

  const usageThreshold = parsed.data.usageThreshold ? Number(parsed.data.usageThreshold) : null;
  const intervalDays = parsed.data.intervalDays ? Number(parsed.data.intervalDays) : null;
  // Volgende datum herberekenen vanaf laatste onderhoud (of nu).
  const from = machine.lastMaintenanceAt ?? new Date();
  const nextMaintenanceAt = computeNextMaintenance(from, intervalDays);

  await prisma.machine.update({
    where: { id: machine.id },
    data: {
      usageThreshold,
      maintenanceIntervalDays: intervalDays,
      nextMaintenanceAt,
      // Reset melding-markers zodat een nieuwe drempel opnieuw kan melden.
      maintenanceDueNotifiedAt: null,
      maintenanceWarnNotifiedAt: null,
    },
  });

  await audit("machine.maintenance.rule", {
    actor: user,
    tenantId: user.tenantId,
    targetType: "Machine",
    targetId: machine.id,
    metadata: { name: machine.name, usageThreshold, intervalDays },
  });

  revalidate(machine.id);
  return { ok: true };
}

// --- Onderhoud vastleggen (uitvoeren) ---------------------------------------

const logSchema = z.object({
  machineId: z.string().min(1),
  kind: z.enum(["SERVICE", "INSPECTION", "SAFETY_CHECK", "REPAIR"]),
  performedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate"),
  action: z.string().trim().min(1, "actionRequired"),
  note: z.string().trim().optional(),
  performedByName: z.string().trim().optional(),
  cost: z.string().trim().optional(),
  nextIntervalDays: z.coerce.number().int().min(0).max(3650).optional(),
});

export async function logMaintenance(
  _prev: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  const user = await requirePermission("maintenance:manage");
  await requireFeature(user.tenantId, "maintenance");
  const parsed = logSchema.safeParse({
    machineId: formData.get("machineId"),
    kind: formData.get("kind"),
    performedAt: formData.get("performedAt"),
    action: formData.get("action"),
    note: formData.get("note") || undefined,
    performedByName: formData.get("performedByName") || undefined,
    cost: formData.get("cost") || undefined,
    nextIntervalDays: formData.get("nextIntervalDays") ? Number(formData.get("nextIntervalDays")) : undefined,
  });
  if (!parsed.success) {
    return { error: await firstValidationError(parsed.error) };
  }
  const d = parsed.data;

  const machine = await loadMachine(d.machineId, user.tenantId);
  if (!machine) return { error: "Machine niet gevonden" };

  const performedAt = new Date(d.performedAt);
  const cost =
    d.cost && !Number.isNaN(Number(d.cost.replace(",", ".")))
      ? Number(d.cost.replace(",", "."))
      : null;
  // Nieuw interval (indien opgegeven) overschrijft; anders het bestaande interval.
  const intervalDays = d.nextIntervalDays && d.nextIntervalDays > 0 ? d.nextIntervalDays : machine.maintenanceIntervalDays;
  const nextMaintenanceAt = computeNextMaintenance(performedAt, intervalDays);

  await prisma.$transaction([
    prisma.maintenanceRecord.create({
      data: {
        tenantId: user.tenantId,
        machineId: machine.id,
        kind: d.kind,
        performedAt,
        action: d.action,
        note: d.note ?? null,
        performedById: user.id,
        performedByName: d.performedByName ?? null,
        cost,
        usageAtService: machine.usageCount,
        nextMaintenanceAt,
      },
    }),
    prisma.machine.update({
      where: { id: machine.id },
      data: {
        status: "ACTIVE",
        usageCount: 0,
        lastMaintenanceAt: performedAt,
        nextMaintenanceAt,
        maintenanceIntervalDays: intervalDays,
        maintenanceDueNotifiedAt: null,
        maintenanceWarnNotifiedAt: null,
      },
    }),
  ]);

  await audit("machine.maintenance.performed", {
    actor: user,
    tenantId: user.tenantId,
    targetType: "Machine",
    targetId: machine.id,
    metadata: { name: machine.name, kind: d.kind, cost },
  });

  // Melding "onderhoud uitgevoerd" (best-effort, exclusief de uitvoerder zelf).
  await notifyMaintenanceEvent({
    tenantId: user.tenantId,
    machineId: machine.id,
    machineName: machine.name,
    event: "performed",
    detail: d.action,
    excludeUserId: user.id,
  });

  revalidate(machine.id);
  return { ok: true };
}

// --- Status handmatig zetten (buiten gebruik / in onderhoud / weer actief) ---

const statusSchema = z.object({
  machineId: z.string().min(1),
  status: z.enum(["ACTIVE", "IN_MAINTENANCE", "OUT_OF_SERVICE"]),
});

export async function setMachineStatus(formData: FormData): Promise<void> {
  const user = await requirePermission("maintenance:manage");
  await requireFeature(user.tenantId, "maintenance");
  const parsed = statusSchema.safeParse({
    machineId: formData.get("machineId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const machine = await loadMachine(parsed.data.machineId, user.tenantId);
  if (!machine) return;

  const nextStatus = parsed.data.status as MachineStatus;
  await prisma.machine.update({
    where: { id: machine.id },
    data: { status: nextStatus },
  });

  await audit("machine.status.change", {
    actor: user,
    tenantId: user.tenantId,
    targetType: "Machine",
    targetId: machine.id,
    oldValue: { status: machine.status },
    newValue: { status: nextStatus },
    metadata: { name: machine.name, status: nextStatus },
  });

  const event =
    nextStatus === "OUT_OF_SERVICE"
      ? "out_of_service"
      : nextStatus === "IN_MAINTENANCE"
        ? "in_maintenance"
        : "reactivated";
  await notifyMaintenanceEvent({
    tenantId: user.tenantId,
    machineId: machine.id,
    machineName: machine.name,
    event,
    excludeUserId: user.id,
  });

  revalidate(machine.id);
}

// --- Gebruiksteller handmatig aanpassen -------------------------------------

const usageSchema = z.object({
  machineId: z.string().min(1),
  usageCount: z.coerce.number().int().min(0).max(10_000_000),
});

export async function adjustUsage(formData: FormData): Promise<void> {
  const user = await requirePermission("maintenance:manage");
  await requireFeature(user.tenantId, "maintenance");
  const parsed = usageSchema.safeParse({
    machineId: formData.get("machineId"),
    usageCount: formData.get("usageCount"),
  });
  if (!parsed.success) return;

  const machine = await loadMachine(parsed.data.machineId, user.tenantId);
  if (!machine) return;

  await prisma.machine.update({
    where: { id: machine.id },
    data: { usageCount: parsed.data.usageCount },
  });

  await audit("machine.usage.adjust", {
    actor: user,
    tenantId: user.tenantId,
    targetType: "Machine",
    targetId: machine.id,
    oldValue: { usageCount: machine.usageCount },
    newValue: { usageCount: parsed.data.usageCount },
    metadata: { name: machine.name },
  });

  // Direct evalueren: bereikt de nieuwe stand een drempel, dan meteen melden.
  const { evaluateDueMachines } = await import("@/lib/maintenance-eval");
  const { due, soon } = await evaluateDueMachines(user.tenantId);
  await notifyMaintenanceThresholds({ tenantId: user.tenantId, dueIds: due, soonIds: soon });

  revalidate(machine.id);
}

// --- Standaardregels per machinetype ----------------------------------------

const policySchema = z.object({
  machineType: z.enum(MACHINE_TYPES),
  usageThreshold: z.coerce.number().int().min(0).max(1_000_000).optional(),
  intervalDays: z.coerce.number().int().min(0).max(3650).optional(),
  applyToExisting: z.string().optional(),
});

export async function saveMaintenancePolicy(
  _prev: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  const user = await requirePermission("maintenance:manage");
  await requireFeature(user.tenantId, "maintenance");
  const parsed = policySchema.safeParse({
    machineType: formData.get("machineType"),
    usageThreshold: formData.get("usageThreshold") ? Number(formData.get("usageThreshold")) : 0,
    intervalDays: formData.get("intervalDays") ? Number(formData.get("intervalDays")) : 0,
    applyToExisting: formData.get("applyToExisting") || undefined,
  });
  if (!parsed.success) return { error: await firstValidationError(parsed.error) };

  const usageThreshold = parsed.data.usageThreshold ? Number(parsed.data.usageThreshold) : null;
  const intervalDays = parsed.data.intervalDays ? Number(parsed.data.intervalDays) : null;

  await prisma.maintenancePolicy.upsert({
    where: { tenantId_machineType: { tenantId: user.tenantId, machineType: parsed.data.machineType } },
    create: {
      tenantId: user.tenantId,
      machineType: parsed.data.machineType,
      usageThreshold,
      intervalDays,
    },
    update: { usageThreshold, intervalDays },
  });

  // Optioneel: bestaande machines van dit type meteen bijwerken.
  if (parsed.data.applyToExisting) {
    const machines = await prisma.machine.findMany({
      where: { tenantId: user.tenantId, type: parsed.data.machineType },
      select: { id: true, lastMaintenanceAt: true },
    });
    await Promise.all(
      machines.map((m) =>
        prisma.machine.update({
          where: { id: m.id },
          data: {
            usageThreshold,
            maintenanceIntervalDays: intervalDays,
            nextMaintenanceAt: computeNextMaintenance(m.lastMaintenanceAt ?? new Date(), intervalDays),
            maintenanceDueNotifiedAt: null,
            maintenanceWarnNotifiedAt: null,
          },
        })
      )
    );
  }

  await audit("machine.maintenance.policy", {
    actor: user,
    tenantId: user.tenantId,
    targetType: "MaintenancePolicy",
    metadata: { type: parsed.data.machineType, usageThreshold, intervalDays },
  });

  revalidate();
  return { ok: true };
}
