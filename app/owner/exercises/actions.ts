"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";

const addSchema = z.object({
  catalogId: z.string().min(1),
  machineId: z.string().optional(),
});

/** Voeg een catalogus-oefening toe aan de sportschool (als tenant-Exercise). */
export async function addCatalogExerciseToGym(formData: FormData) {
  const owner = await requireOwner();

  const parsed = addSchema.safeParse({
    catalogId: formData.get("catalogId"),
    machineId: formData.get("machineId") || undefined,
  });
  if (!parsed.success) return;
  const { catalogId, machineId } = parsed.data;

  const catalog = await prisma.exerciseCatalog.findUnique({
    where: { id: catalogId },
    select: { name: true, target: true },
  });
  if (!catalog) return;

  // Idempotent: niet nog een keer toevoegen als deze catalogus-oefening al in
  // de sportschool zit.
  const existing = await prisma.exercise.findFirst({
    where: { tenantId: owner.tenantId, catalogId },
    select: { id: true },
  });
  if (existing) {
    revalidatePath("/owner/exercises");
    return;
  }

  // Machine moet bij deze tenant horen (anders negeren we 'm).
  let validMachineId: string | null = null;
  if (machineId) {
    const machine = await prisma.machine.findFirst({
      where: { id: machineId, tenantId: owner.tenantId },
      select: { id: true },
    });
    validMachineId = machine?.id ?? null;
  }

  await prisma.exercise.create({
    data: {
      tenantId: owner.tenantId,
      name: catalog.name,
      targetMuscle: catalog.target,
      catalogId,
      machineId: validMachineId,
    },
  });

  revalidatePath("/owner/exercises");
}

/** Verwijder een eerder toegevoegde catalogus-oefening uit de sportschool. */
export async function removeCatalogExerciseFromGym(formData: FormData) {
  const owner = await requireOwner();
  const catalogId = String(formData.get("catalogId") ?? "");
  if (!catalogId) return;

  // deleteMany scoped op tenant; faalt stil als de oefening in een schema zit
  // (FK) — dat is acceptabel, de owner haalt 'm dan eerst uit het schema.
  await prisma.exercise
    .deleteMany({ where: { tenantId: owner.tenantId, catalogId } })
    .catch(() => {});

  revalidatePath("/owner/exercises");
}
