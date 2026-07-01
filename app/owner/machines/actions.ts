"use server";

import { z } from "zod";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { uploadMachineImage } from "@/lib/blob";
import { MACHINE_TYPES } from "@/lib/machine";
import { audit } from "@/lib/audit";

export type MachineFormState = { error?: string };

const machineSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Naam is verplicht"),
  type: z.enum(MACHINE_TYPES),
  description: z.string().trim().optional(),
  instructionsMd: z.string().optional(),
  videoUrl: z
    .string()
    .trim()
    .url("Ongeldige video-URL")
    .optional()
    .or(z.literal("")),
  location: z.string().trim().optional(),
  serialNumber: z.string().trim().optional(),
  purchaseDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum")
    .optional()
    .or(z.literal("")),
});

function qrToken(): string {
  return randomBytes(8).toString("hex"); // 16 hex-chars
}

export async function saveMachine(
  _prev: MachineFormState,
  formData: FormData
): Promise<MachineFormState> {
  const owner = await requireOwner();

  const parsed = machineSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    type: formData.get("type"),
    description: formData.get("description") || undefined,
    instructionsMd: formData.get("instructionsMd") || undefined,
    videoUrl: formData.get("videoUrl") || "",
    location: formData.get("location") || undefined,
    serialNumber: formData.get("serialNumber") || undefined,
    purchaseDate: formData.get("purchaseDate") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const data = parsed.data;
  const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: owner.tenantId },
    select: { slug: true },
  });
  if (!tenant) return { error: "Tenant niet gevonden" };

  const photo = formData.get("photo");
  const imageUrl = await uploadMachineImage(
    photo instanceof File ? photo : null,
    tenant.slug
  );

  let machineId = data.id;

  if (data.id) {
    // Update — gescoped op tenant zodat een owner alleen eigen machines wijzigt.
    const result = await prisma.machine.updateMany({
      where: { id: data.id, tenantId: owner.tenantId },
      data: {
        name: data.name,
        type: data.type,
        description: data.description ?? null,
        instructionsMd: data.instructionsMd ?? null,
        videoUrl: data.videoUrl || null,
        location: data.location ?? null,
        serialNumber: data.serialNumber ?? null,
        purchaseDate,
        ...(imageUrl ? { imageUrl } : {}),
      },
    });
    if (result.count === 0) return { error: "Machine niet gevonden" };
    await audit("machine.update", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "Machine",
      targetId: data.id,
      newValue: { name: data.name, type: data.type },
      metadata: { name: data.name },
    });
  } else {
    // Standaard onderhoudsregels per type (indien ingesteld) alvast toepassen.
    const policy = await prisma.maintenancePolicy.findUnique({
      where: { tenantId_machineType: { tenantId: owner.tenantId, machineType: data.type } },
      select: { usageThreshold: true, intervalDays: true },
    });
    const nextMaintenanceAt =
      policy?.intervalDays && policy.intervalDays > 0
        ? new Date(Date.now() + policy.intervalDays * 86_400_000)
        : null;
    const created = await prisma.machine.create({
      data: {
        tenantId: owner.tenantId,
        name: data.name,
        type: data.type,
        description: data.description ?? null,
        instructionsMd: data.instructionsMd ?? null,
        videoUrl: data.videoUrl || null,
        location: data.location ?? null,
        serialNumber: data.serialNumber ?? null,
        purchaseDate,
        imageUrl: imageUrl ?? null,
        usageThreshold: policy?.usageThreshold ?? null,
        maintenanceIntervalDays: policy?.intervalDays ?? null,
        nextMaintenanceAt,
        qrToken: qrToken(),
      },
    });
    machineId = created.id;
    await audit("machine.create", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "Machine",
      targetId: created.id,
      metadata: { name: data.name },
    });
  }

  revalidatePath("/owner/machines");
  redirect(`/owner/machines/${machineId}`);
}

export async function deleteMachine(formData: FormData) {
  const owner = await requireOwner();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const existing = await prisma.machine.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: { name: true },
  });
  const { count } = await prisma.machine.deleteMany({
    where: { id, tenantId: owner.tenantId },
  });
  if (count > 0) {
    await audit("machine.delete", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "Machine",
      targetId: id,
      oldValue: existing ? { name: existing.name } : undefined,
      metadata: { name: existing?.name },
    });
  }

  revalidatePath("/owner/machines");
  redirect("/owner/machines");
}
