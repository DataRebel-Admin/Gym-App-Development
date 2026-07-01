"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { audit } from "@/lib/audit";
import { isExerciseType } from "@/lib/exercise-types";

/** Parse een optioneel positief geheel getal uit een formveld (leeg → null). */
function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 100000) : null;
}

/** Maak een nieuw (leeg) kader en ga naar de bewerk-pagina. */
export async function createFramework() {
  const owner = await requirePermission("schemas:manage");
  const created = await prisma.schemaFramework.create({
    data: { tenantId: owner.tenantId, name: "Nieuw kader" },
  });
  await audit("schema.framework.save", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "SchemaFramework",
    targetId: created.id,
    metadata: { name: created.name },
  });
  redirect(`/owner/schemas/frameworks/${created.id}`);
}

const saveSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  isDefault: z.boolean(),
  requireApproval: z.enum(["default", "yes", "no"]),
});

/** Sla een kader op (beperkingen + evt. tenant-default). */
export async function saveFramework(formData: FormData) {
  const owner = await requirePermission("schemas:manage");

  const parsed = saveSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description"),
    isDefault: formData.get("isDefault") === "on",
    requireApproval: String(formData.get("requireApproval") ?? "default"),
  });
  if (!parsed.success) redirect("/owner/schemas/frameworks");
  const d = parsed.data;

  const existing = await prisma.schemaFramework.findFirst({
    where: { id: d.id, tenantId: owner.tenantId },
    select: { id: true },
  });
  if (!existing) redirect("/owner/schemas/frameworks");

  // Toegestane types (uit checkboxes) — alleen bekende types.
  const allowedTypes = formData
    .getAll("allowedTypes")
    .map(String)
    .filter((t) => isExerciseType(t));

  // Toegestane oefeningen (JSON hidden) — valideer tegen de tenant.
  let allowedExerciseIds: string[] = [];
  try {
    const raw = JSON.parse(String(formData.get("allowedExerciseIds") ?? "[]"));
    if (Array.isArray(raw)) allowedExerciseIds = raw.map(String).filter(Boolean).slice(0, 2000);
  } catch {
    allowedExerciseIds = [];
  }
  if (allowedExerciseIds.length > 0) {
    const valid = await prisma.exercise.findMany({
      where: { tenantId: owner.tenantId, id: { in: allowedExerciseIds } },
      select: { id: true },
    });
    allowedExerciseIds = valid.map((e) => e.id);
  }

  const requireApproval =
    d.requireApproval === "yes" ? true : d.requireApproval === "no" ? false : null;

  await prisma.$transaction(async (tx) => {
    if (d.isDefault) {
      // Slechts één tenant-default kader.
      await tx.schemaFramework.updateMany({
        where: { tenantId: owner.tenantId, isDefault: true, id: { not: d.id } },
        data: { isDefault: false },
      });
    }
    await tx.schemaFramework.update({
      where: { id: d.id },
      data: {
        name: d.name,
        description: d.description?.trim() || null,
        isDefault: d.isDefault,
        allowedTypes,
        allowedExerciseIds,
        minDays: intOrNull(formData.get("minDays")),
        maxDays: intOrNull(formData.get("maxDays")),
        minExercisesPerDay: intOrNull(formData.get("minExercisesPerDay")),
        maxExercisesPerDay: intOrNull(formData.get("maxExercisesPerDay")),
        setsMin: intOrNull(formData.get("setsMin")),
        setsMax: intOrNull(formData.get("setsMax")),
        repsMin: intOrNull(formData.get("repsMin")),
        repsMax: intOrNull(formData.get("repsMax")),
        restMin: intOrNull(formData.get("restMin")),
        restMax: intOrNull(formData.get("restMax")),
        requireApproval,
      },
    });
  });

  await audit("schema.framework.save", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "SchemaFramework",
    targetId: d.id,
    metadata: { name: d.name },
  });

  revalidatePath("/owner/schemas/frameworks");
  redirect("/owner/schemas/frameworks");
}

/** Verwijder een kader (koppelingen cascaden). */
export async function deleteFramework(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.schemaFramework.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: { name: true },
  });
  const { count } = await prisma.schemaFramework.deleteMany({
    where: { id, tenantId: owner.tenantId },
  });
  if (count > 0) {
    await audit("schema.framework.delete", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "SchemaFramework",
      targetId: id,
      metadata: { name: existing?.name },
    });
  }
  revalidatePath("/owner/schemas/frameworks");
  redirect("/owner/schemas/frameworks");
}

/** Koppel (of ontkoppel) een kader aan een lid. Leeg frameworkId = ontkoppelen. */
export async function setMemberFramework(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
  const userId = String(formData.get("userId") ?? "");
  const frameworkId = String(formData.get("frameworkId") ?? "").trim();
  const back = `/owner/schemas/members/${userId}`;

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId, role: "TENANT_MEMBER" },
    select: { id: true, name: true, email: true },
  });
  if (!member) redirect("/owner/schemas/members");

  if (!frameworkId) {
    await prisma.memberFrameworkAssignment.deleteMany({
      where: { tenantId: owner.tenantId, memberId: userId },
    });
  } else {
    const framework = await prisma.schemaFramework.findFirst({
      where: { id: frameworkId, tenantId: owner.tenantId },
      select: { id: true },
    });
    if (!framework) redirect(back);
    await prisma.memberFrameworkAssignment.upsert({
      where: { tenantId_memberId: { tenantId: owner.tenantId, memberId: userId } },
      create: {
        tenantId: owner.tenantId,
        memberId: userId,
        frameworkId,
        assignedById: owner.id,
      },
      update: { frameworkId, assignedById: owner.id },
    });
  }

  await audit("schema.framework.assign", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "User",
    targetId: userId,
    metadata: { member: member.name ?? member.email },
  });

  revalidatePath(back);
  redirect(back);
}
