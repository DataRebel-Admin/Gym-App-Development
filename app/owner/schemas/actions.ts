"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { audit } from "@/lib/audit";
import { loadTenantBranding } from "@/lib/email/branding";
import { schemaAssignedMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import { prefAllows, createInAppNotification } from "@/lib/notifications";

export type SchemaSaveState = { error?: string; ok?: boolean };

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Meld leden dat er een (nieuw) trainingsschema voor ze klaarstaat. Best-effort:
 * een mailfout mag de toewijzing nooit breken (eigen try/catch). Aanroepen vóór
 * een eventuele redirect.
 */
async function notifySchemaAssigned(
  tenantId: string,
  userIds: string[],
  schemaName: string
): Promise<void> {
  try {
    const [branding, members, viewUrl] = await Promise.all([
      loadTenantBranding(tenantId),
      prisma.user.findMany({
        where: { id: { in: userIds }, tenantId, role: "TENANT_MEMBER", active: true },
        select: { id: true, email: true, name: true, notificationPrefs: true },
      }),
      origin().then((o) => `${o}/member/schema`),
    ]);
    for (const m of members) {
      // In-app melding (kanaal "inApp") en e-mail (kanaal "email") staan los van
      // elkaar — respecteer beide voorkeuren onder categorie "schema's".
      if (prefAllows(m.notificationPrefs, "schemas", "inApp")) {
        await createInAppNotification({
          userId: m.id,
          tenantId,
          category: "schemas",
          title: "Nieuw trainingsschema",
          body: `Je traint nu met '${schemaName}'.`,
          link: "/member/schema",
        });
      }
      if (prefAllows(m.notificationPrefs, "schemas", "email")) {
        await sendEmail({
          to: m.email,
          message: schemaAssignedMessage({
            branding,
            recipientName: m.name,
            schemaName,
            viewUrl,
          }),
          devLink: viewUrl,
        });
      }
    }
  } catch (err) {
    console.error("✗ Schema-toewijzing mail mislukt:", (err as Error).message);
  }
}

const itemSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100),
  restSeconds: z.number().int().min(0).max(600),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  notes: z.string().trim().max(280).nullable().optional(),
});
const daySchema = z.object({
  name: z.string().trim().min(1).max(60),
  items: z.array(itemSchema).max(50),
});
const daysSchema = z.array(daySchema).max(14);

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

  let days;
  try {
    days = daysSchema.parse(JSON.parse(String(formData.get("days") ?? "[]")));
  } catch {
    return { error: "Ongeldige schema-indeling" };
  }

  const template = await prisma.workoutTemplate.findFirst({
    where: { id: templateId, tenantId: owner.tenantId },
  });
  if (!template) return { error: "Schema niet gevonden" };

  try {
    await assertExercisesInTenant(
      owner.tenantId,
      days.flatMap((d) => d.items.map((i) => i.exerciseId))
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Validatiefout" };
  }

  await prisma.$transaction([
    prisma.workoutTemplate.update({
      where: { id: template.id },
      data: { name, description: description || null },
    }),
    // Items en dagen volledig vervangen (items cascaden via day-FK, maar we
    // ruimen expliciet op voor items zonder dag).
    prisma.workoutExerciseItem.deleteMany({ where: { templateId: template.id } }),
    prisma.workoutDay.deleteMany({ where: { templateId: template.id } }),
    ...days.map((d, dayIdx) =>
      prisma.workoutDay.create({
        data: {
          tenantId: owner.tenantId,
          templateId: template.id,
          order: dayIdx,
          name: d.name,
          items: {
            create: d.items.map((it, idx) => ({
              tenantId: owner.tenantId,
              templateId: template.id,
              exerciseId: it.exerciseId,
              order: idx,
              sets: it.sets,
              reps: it.reps,
              restSeconds: it.restSeconds,
              weightKg: it.weightKg ?? null,
              notes: it.notes?.trim() ? it.notes.trim() : null,
            })),
          },
        },
      })
    ),
  ]);

  await audit("schema.update", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "WorkoutTemplate",
    targetId: template.id,
    oldValue: { name: template.name, description: template.description },
    newValue: { name, description: description || null, days: days.length },
    metadata: { name },
  });

  revalidatePath("/owner/schemas");
  return { ok: true };
}

/** Maak een lege library-template en ga naar de edit-pagina. */
export async function createTemplate() {
  const owner = await requireOwner();
  const created = await prisma.workoutTemplate.create({
    data: { tenantId: owner.tenantId, name: "Nieuw schema", isLibrary: true },
  });
  await audit("schema.create", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "WorkoutTemplate",
    targetId: created.id,
    metadata: { name: created.name },
  });
  redirect(`/owner/schemas/templates/${created.id}`);
}

export async function deleteTemplate(formData: FormData) {
  const owner = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.workoutTemplate.findFirst({
    where: { id, tenantId: owner.tenantId, isLibrary: true },
    select: { name: true },
  });
  const { count } = await prisma.workoutTemplate.deleteMany({
    where: { id, tenantId: owner.tenantId, isLibrary: true },
  });
  if (count > 0) {
    await audit("schema.delete", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "WorkoutTemplate",
      targetId: id,
      oldValue: existing ? { name: existing.name } : undefined,
      metadata: { name: existing?.name },
    });
  }
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

type SourceTemplate = {
  name: string;
  description: string | null;
  days: {
    order: number;
    name: string;
    items: {
      exerciseId: string;
      order: number;
      sets: number;
      reps: number;
      restSeconds: number;
      weightKg: number | null;
      notes: string | null;
    }[];
  }[];
};

const sourceInclude = {
  days: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
} as const;

/** Kloon (binnen een transactie) een bron-template naar een nieuw lid-schema +
 *  wijs het toe. Vervangt het bestaande lid-schema. */
async function assignTemplateToUser(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  source: SourceTemplate
) {
  const existing = await tx.assignedWorkout.findFirst({
    where: { tenantId, userId },
    include: { template: true },
  });
  if (existing) {
    await tx.assignedWorkout.delete({ where: { id: existing.id } });
    if (existing.template && !existing.template.isLibrary) {
      await tx.workoutTemplate.delete({ where: { id: existing.template.id } });
    }
  }

  const tpl = await tx.workoutTemplate.create({
    data: {
      tenantId,
      name: source.name,
      description: source.description,
      isLibrary: false,
      assignedWorkouts: { create: { tenantId, userId } },
    },
  });

  for (const d of source.days) {
    await tx.workoutDay.create({
      data: {
        tenantId,
        templateId: tpl.id,
        order: d.order,
        name: d.name,
        items: {
          create: d.items.map((it) => ({
            tenantId,
            templateId: tpl.id,
            exerciseId: it.exerciseId,
            order: it.order,
            sets: it.sets,
            reps: it.reps,
            restSeconds: it.restSeconds,
            weightKg: it.weightKg,
            notes: it.notes,
          })),
        },
      },
    });
  }
}

/** Kopieer een library-template naar een lid-specifiek schema en wijs het toe. */
export async function assignFromTemplate(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  const sourceId = String(formData.get("sourceTemplateId") ?? "");

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId, role: "TENANT_MEMBER" },
  });
  if (!member) redirect("/owner/schemas/members");

  const source = await prisma.workoutTemplate.findFirst({
    where: { id: sourceId, tenantId: owner.tenantId },
    include: sourceInclude,
  });
  if (!source) redirect(`/owner/schemas/members/${userId}`);

  await prisma.$transaction((tx) =>
    assignTemplateToUser(tx, owner.tenantId, userId, source)
  );

  await audit("schema.assign", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "User",
    targetId: userId,
    metadata: { name: source.name, memberCount: 1, member: member.name ?? member.email },
  });

  await notifySchemaAssigned(owner.tenantId, [userId], source.name);

  revalidatePath(`/owner/schemas/members/${userId}`);
  redirect(`/owner/schemas/members/${userId}`);
}

/** Wijs één library-template tegelijk toe aan meerdere leden (G3c). */
export async function assignTemplateToMembers(formData: FormData) {
  const owner = await requireOwner();
  const sourceId = String(formData.get("sourceTemplateId") ?? "");
  const userIds = formData.getAll("userIds").map(String).filter(Boolean);
  if (!sourceId || userIds.length === 0) return;

  const source = await prisma.workoutTemplate.findFirst({
    where: { id: sourceId, tenantId: owner.tenantId, isLibrary: true },
    include: sourceInclude,
  });
  if (!source) return;

  // Alleen geldige leden van deze tenant.
  const members = await prisma.user.findMany({
    where: { id: { in: userIds }, tenantId: owner.tenantId, role: "TENANT_MEMBER" },
    select: { id: true },
  });

  for (const m of members) {
    await prisma.$transaction((tx) =>
      assignTemplateToUser(tx, owner.tenantId, m.id, source)
    );
  }

  if (members.length > 0) {
    await audit("schema.assign", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "WorkoutTemplate",
      targetId: sourceId,
      metadata: { name: source.name, memberCount: members.length },
    });
    await notifySchemaAssigned(
      owner.tenantId,
      members.map((m) => m.id),
      source.name
    );
  }

  revalidatePath("/owner/schemas/templates");
}

/** Dupliceer een library-template (incl. dagen + oefeningen) (G3c). */
export async function duplicateTemplate(formData: FormData) {
  const owner = await requireOwner();
  const sourceId = String(formData.get("id") ?? "");

  const source = await prisma.workoutTemplate.findFirst({
    where: { id: sourceId, tenantId: owner.tenantId, isLibrary: true },
    include: sourceInclude,
  });
  if (!source) redirect("/owner/schemas/templates");

  const copy = await prisma.$transaction(async (tx) => {
    const tpl = await tx.workoutTemplate.create({
      data: {
        tenantId: owner.tenantId,
        name: `${source.name} (kopie)`,
        description: source.description,
        isLibrary: true,
      },
    });
    for (const d of source.days) {
      await tx.workoutDay.create({
        data: {
          tenantId: owner.tenantId,
          templateId: tpl.id,
          order: d.order,
          name: d.name,
          items: {
            create: d.items.map((it) => ({
              tenantId: owner.tenantId,
              templateId: tpl.id,
              exerciseId: it.exerciseId,
              order: it.order,
              sets: it.sets,
              reps: it.reps,
              restSeconds: it.restSeconds,
              weightKg: it.weightKg,
              notes: it.notes,
            })),
          },
        },
      });
    }
    return tpl;
  });

  await audit("schema.duplicate", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "WorkoutTemplate",
    targetId: copy.id,
    metadata: { name: source.name, copyId: copy.id },
  });

  revalidatePath("/owner/schemas/templates");
  redirect(`/owner/schemas/templates/${copy.id}`);
}

/** Start een leeg lid-specifiek schema voor een lid. */
export async function startEmptySchema(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId, role: "TENANT_MEMBER" },
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

  await audit("schema.assign", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "User",
    targetId: userId,
    metadata: { name: "Nieuw schema", memberCount: 1, member: member.name ?? member.email },
  });

  await notifySchemaAssigned(owner.tenantId, [userId], "Nieuw schema");

  revalidatePath(`/owner/schemas/members/${userId}`);
  redirect(`/owner/schemas/members/${userId}`);
}

export async function removeAssignment(formData: FormData) {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  const clearOps = await clearAssignment(owner.tenantId, userId);
  if (clearOps.length > 0) {
    await prisma.$transaction(clearOps);
    await audit("schema.unassign", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "User",
      targetId: userId,
    });
  }
  revalidatePath(`/owner/schemas/members/${userId}`);
  redirect(`/owner/schemas/members/${userId}`);
}
