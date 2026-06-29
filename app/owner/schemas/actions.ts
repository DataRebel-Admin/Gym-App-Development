"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";

export type SchemaSaveState = { error?: string; ok?: boolean };

const itemSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100),
  restSeconds: z.number().int().min(0).max(600),
});
const itemsSchema = z.array(itemSchema).max(50);

/** Valideer dat alle exerciseIds tot deze tenant horen. */
async function assertExercisesInTenant(tenantId: string, ids: string[]) {
  if (ids.length === 0) return;
  const count = await prisma.exercise.count({
    where: { tenantId, id: { in: ids } },
  });
  if (count !== new Set(ids).size) {
    throw new Error("Eén of meer oefeningen horen niet bij deze sportschool.");
  }
}

/** Sla naam, beschrijving én de volledige oefeningenlijst atomair op. */
export async function saveSchema(
  _prev: SchemaSaveState,
  formData: FormData
): Promise<SchemaSaveState> {
  const owner = await requireOwner();
  const templateId = String(formData.get("templateId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) return { error: "Naam is verplicht" };

  let items;
  try {
    items = itemsSchema.parse(JSON.parse(String(formData.get("items") ?? "[]")));
  } catch {
    return { error: "Ongeldige oefeningenlijst" };
  }

  const template = await prisma.workoutTemplate.findFirst({
    where: { id: templateId, tenantId: owner.tenantId },
  });
  if (!template) return { error: "Schema niet gevonden" };

  try {
    await assertExercisesInTenant(
      owner.tenantId,
      items.map((i) => i.exerciseId)
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Validatiefout" };
  }

  await prisma.$transaction([
    prisma.workoutTemplate.update({
      where: { id: template.id },
      data: { name, description: description || null },
    }),
    prisma.workoutExerciseItem.deleteMany({ where: { templateId: template.id } }),
    prisma.workoutExerciseItem.createMany({
      data: items.map((it, idx) => ({
        tenantId: owner.tenantId,
        templateId: template.id,
        exerciseId: it.exerciseId,
        order: idx,
        sets: it.sets,
        reps: it.reps,
        restSeconds: it.restSeconds,
      })),
    }),
  ]);

  revalidatePath("/owner/schemas");
  return { ok: true };
}

/** Maak een lege library-template en ga naar de edit-pagina. */
export async function createTemplate() {
  const owner = await requireOwner();
  const created = await prisma.workoutTemplate.create({
    data: { tenantId: owner.tenantId, name: "Nieuw schema", isLibrary: true },
  });
  redirect(`/owner/schemas/templates/${created.id}`);
}

export async function deleteTemplate(formData: FormData) {
  const owner = await requireOwner();
  const id = String(formData.get("id") ?? "");
  await prisma.workoutTemplate.deleteMany({
    where: { id, tenantId: owner.tenantId, isLibrary: true },
  });
  revalidatePath("/owner/schemas/templates");
  redirect("/owner/schemas/templates");
}

/** Verwijder het huidige (lid-specifieke) schema van een lid. */
async function clearAssignment(tenantId: string, userId: string) {
  const existing = await prisma.assignedWorkout.findFirst({
    where: { tenantId, userId },
    include: { template: true },
  });
  if (!existing) return [];
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.assignedWorkout.delete({ where: { id: existing.id } }),
  ];
  // Lid-specifieke (niet-library) template mag mee weg.
  if (existing.template && !existing.template.isLibrary) {
    ops.push(
      prisma.workoutTemplate.delete({ where: { id: existing.template.id } })
    );
  }
  return ops;
}

/** Kopieer een library-template naar een lid-specifiek schema en wijs het toe. */
export async function assignFromTemplate(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  const sourceId = String(formData.get("sourceTemplateId") ?? "");

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId, role: "MEMBER" },
  });
  if (!member) redirect("/owner/schemas/members");

  const source = await prisma.workoutTemplate.findFirst({
    where: { id: sourceId, tenantId: owner.tenantId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!source) redirect(`/owner/schemas/members/${userId}`);

  const clearOps = await clearAssignment(owner.tenantId, userId);

  await prisma.$transaction([
    ...clearOps,
    prisma.workoutTemplate.create({
      data: {
        tenantId: owner.tenantId,
        name: source.name,
        description: source.description,
        isLibrary: false,
        assignedWorkouts: { create: { tenantId: owner.tenantId, userId } },
        items: {
          create: source.items.map((it) => ({
            tenantId: owner.tenantId,
            exerciseId: it.exerciseId,
            order: it.order,
            sets: it.sets,
            reps: it.reps,
            restSeconds: it.restSeconds,
          })),
        },
      },
    }),
  ]);

  revalidatePath(`/owner/schemas/members/${userId}`);
  redirect(`/owner/schemas/members/${userId}`);
}

/** Start een leeg lid-specifiek schema voor een lid. */
export async function startEmptySchema(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId, role: "MEMBER" },
  });
  if (!member) redirect("/owner/schemas/members");

  const clearOps = await clearAssignment(owner.tenantId, userId);

  await prisma.$transaction([
    ...clearOps,
    prisma.workoutTemplate.create({
      data: {
        tenantId: owner.tenantId,
        name: "Nieuw schema",
        isLibrary: false,
        assignedWorkouts: { create: { tenantId: owner.tenantId, userId } },
      },
    }),
  ]);

  revalidatePath(`/owner/schemas/members/${userId}`);
  redirect(`/owner/schemas/members/${userId}`);
}

export async function removeAssignment(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  const clearOps = await clearAssignment(owner.tenantId, userId);
  if (clearOps.length > 0) await prisma.$transaction(clearOps);
  revalidatePath(`/owner/schemas/members/${userId}`);
  redirect(`/owner/schemas/members/${userId}`);
}
