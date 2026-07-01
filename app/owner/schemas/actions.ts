"use server";

import { z } from "zod";
import { Prisma, type AssignmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { audit } from "@/lib/audit";
import { notifyAssignmentsPublished } from "@/lib/schema-notify";
import { notifyMemberSchemaReviewed } from "@/lib/member-schema-notify";
import { isExerciseType, DEFAULT_EXERCISE_TYPE } from "@/lib/exercise-types";
import { isTrainingGoal } from "@/lib/training-goals";
import { parseBadges } from "@/lib/schema-badges";
import { paramsFromInputValues, itemColumnsFromParams } from "@/lib/exercise-params";
import {
  snapshotOf,
  asSnapshot,
  diffSnapshots,
  applyEntryToSnapshot,
  type DiffEntry,
  type ItemField,
  type ItemSnapshot,
} from "@/lib/schema-diff";

export type SchemaSaveState = { error?: string; ok?: boolean };

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Editor-item: oefeningstype + dynamische invoerwaarden (per veld-id, in
// invoer-eenheid). De server zet ze met de registry om naar kolommen + JSON.
const itemSchema = z.object({
  exerciseId: z.string().min(1),
  exerciseType: z.string().min(1),
  values: z.record(z.string(), z.string()).default({}),
  notes: z.string().trim().max(280).nullable().optional(),
});
const daySchema = z.object({
  name: z.string().trim().min(1).max(60),
  notes: z.string().trim().max(280).nullable().optional(),
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
  const owner = await requirePermission("schemas:manage");
  const templateId = String(formData.get("templateId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const coachNote = String(formData.get("coachNote") ?? "").trim();
  const validityRaw = String(formData.get("validityWeeks") ?? "").trim();
  const validityNum = validityRaw ? Math.round(Number(validityRaw)) : NaN;
  const validityWeeks =
    Number.isFinite(validityNum) && validityNum > 0 ? Math.min(104, validityNum) : null;
  const goalRaw = String(formData.get("goal") ?? "").trim();
  const goal = isTrainingGoal(goalRaw) ? goalRaw : null;
  let badges: string[] = [];
  try {
    badges = parseBadges(JSON.parse(String(formData.get("badges") ?? "[]")));
  } catch {
    badges = [];
  }

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
      data: { name, description: description || null, coachNote: coachNote || null, validityWeeks, goal, badges },
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
          notes: d.notes?.trim() ? d.notes.trim() : null,
          items: {
            create: d.items.map((it, idx) => {
              const typeKey = isExerciseType(it.exerciseType)
                ? it.exerciseType
                : DEFAULT_EXERCISE_TYPE;
              const cols = itemColumnsFromParams(
                typeKey,
                paramsFromInputValues(typeKey, it.values)
              );
              return {
                tenantId: owner.tenantId,
                templateId: template.id,
                exerciseId: it.exerciseId,
                order: idx,
                sets: cols.sets,
                reps: cols.reps,
                restSeconds: cols.restSeconds,
                weightKg: cols.weightKg,
                tempo: cols.tempo,
                params: cols.params ?? undefined,
                notes: it.notes?.trim() ? it.notes.trim() : null,
              };
            }),
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

/** Maak een lege library-template (schema of dag) en ga naar de edit-pagina. */
export async function createTemplate(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
  const kind = String(formData.get("kind") ?? "SCHEMA") === "DAY" ? "DAY" : "SCHEMA";
  const created = await prisma.workoutTemplate.create({
    data: {
      tenantId: owner.tenantId,
      name: kind === "DAY" ? "Nieuwe dag" : "Nieuw schema",
      isLibrary: true,
      kind,
    },
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
  const owner = await requirePermission("schemas:manage");
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

type SourceTemplate = {
  name: string;
  description: string | null;
  coachNote: string | null;
  validityWeeks: number | null;
  goal: string | null;
  badges: string[];
  updatedAt: Date;
  days: {
    order: number;
    name: string;
    notes: string | null;
    items: {
      exerciseId: string;
      order: number;
      sets: number;
      reps: number;
      restSeconds: number;
      weightKg: number | null;
      tempo: string | null;
      params: Prisma.JsonValue | null;
      notes: string | null;
    }[];
  }[];
};

const sourceInclude = {
  days: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
} as const;

/** Parse een datetime-local/ISO string naar Date; ongeldig of leeg → null. */
function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Kloon (binnen een transactie) een bron-template naar een nieuw lid-specifiek
 * schema + maak de toewijzing met levenscyclus-velden. Vervangt NIET automatisch
 * een bestaand schema — meerdere toewijzingen per lid zijn toegestaan; de
 * caller archiveert eventueel het vorige actieve schema. Retourneert de
 * assignment-id.
 */
async function cloneToAssignment(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    userId: string;
    assignedById: string;
    source: SourceTemplate;
    sourceTemplateId: string | null;
    status: AssignmentStatus;
    availableFrom: Date | null;
    startDate: Date | null;
    endDate: Date | null;
    trainerMessage: string | null;
    publishedAt: Date | null;
  }
): Promise<string> {
  const { tenantId, userId, source } = params;
  const tpl = await tx.workoutTemplate.create({
    data: {
      tenantId,
      name: source.name,
      description: source.description,
      coachNote: source.coachNote,
      validityWeeks: source.validityWeeks,
      goal: source.goal,
      badges: source.badges,
      isLibrary: false,
    },
  });
  for (const d of source.days) {
    await tx.workoutDay.create({
      data: {
        tenantId,
        templateId: tpl.id,
        order: d.order,
        name: d.name,
        notes: d.notes,
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
            tempo: it.tempo,
            params: it.params ?? undefined,
            notes: it.notes,
          })),
        },
      },
    });
  }
  const assignment = await tx.assignedWorkout.create({
    data: {
      tenantId,
      userId,
      templateId: tpl.id,
      sourceTemplateId: params.sourceTemplateId,
      assignedById: params.assignedById,
      status: params.status,
      availableFrom: params.availableFrom,
      startDate: params.startDate,
      endDate: params.endDate,
      trainerMessage: params.trainerMessage,
      publishedAt: params.publishedAt,
      // Baseline = master-staat op koppelmoment (bron voor 3-weg-diff).
      baselineSnapshot: snapshotOf(source),
      masterSyncedAt: source.updatedAt,
    },
  });
  return assignment.id;
}

/**
 * Archiveer (binnen een transactie) de actieve, gepubliceerde toewijzingen van
 * een lid. Behoudt ze als historie (status ARCHIVED) i.p.v. ze te verwijderen.
 * Retourneert true als er een actief schema was (→ "opnieuw toegewezen").
 */
async function archivePriorActive(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string
): Promise<boolean> {
  const { count } = await tx.assignedWorkout.updateMany({
    where: { tenantId, userId, status: "PUBLISHED" },
    data: { status: "ARCHIVED" },
  });
  return count > 0;
}

const assignOptionsSchema = z.object({
  mode: z.enum(["now", "draft", "schedule"]),
  availableFrom: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  trainerMessage: z.string().trim().max(1000).optional().nullable(),
});

export type AssignOptions = z.infer<typeof assignOptionsSchema>;
export type AssignChunkResult = {
  assigned: number;
  reassigned: number;
  scheduled: number;
  drafted: number;
  error?: string;
};

/**
 * Wijs één library-template toe aan een batch leden, met levenscyclus
 * (direct publiceren / concept / inplannen), ingangs-/einddatum en een
 * persoonlijke boodschap. Bewust per chunk aan te roepen vanuit de client zodat
 * bulktoewijzingen (duizenden leden) een echte voortgangsindicator hebben en
 * binnen serverless-tijdslimieten blijven.
 */
export async function assignSchemaChunk(
  sourceTemplateId: string,
  userIds: string[],
  rawOptions: AssignOptions
): Promise<AssignChunkResult> {
  const owner = await requirePermission("schemas:manage");
  const empty: AssignChunkResult = { assigned: 0, reassigned: 0, scheduled: 0, drafted: 0 };

  const parsed = assignOptionsSchema.safeParse(rawOptions);
  if (!parsed.success) return { ...empty, error: "Ongeldige toewijs-opties" };
  const opts = parsed.data;

  const ids = [...new Set(userIds.map(String).filter(Boolean))].slice(0, 200);
  if (!sourceTemplateId || ids.length === 0) return empty;

  const source = await prisma.workoutTemplate.findFirst({
    where: { id: sourceTemplateId, tenantId: owner.tenantId, isLibrary: true },
    include: sourceInclude,
  });
  if (!source) return { ...empty, error: "Schema niet gevonden" };

  const availableFrom = parseDate(opts.availableFrom);
  const startDate = parseDate(opts.startDate);
  const endDate = parseDate(opts.endDate);
  const trainerMessage = opts.trainerMessage?.trim() || null;

  if (opts.mode === "schedule" && !availableFrom) {
    return { ...empty, error: "Kies een geldig publicatiemoment" };
  }

  // Alleen geldige, actieve leden van deze tenant.
  const members = await prisma.user.findMany({
    where: { id: { in: ids }, tenantId: owner.tenantId, role: "TENANT_MEMBER", active: true },
    select: { id: true },
  });
  if (members.length === 0) return empty;

  const result: AssignChunkResult = { ...empty };
  const publishedAssignmentIds: string[] = [];

  for (const m of members) {
    try {
      const status: AssignmentStatus =
        opts.mode === "now" ? "PUBLISHED" : opts.mode === "schedule" ? "SCHEDULED" : "DRAFT";
      const publishedAt = opts.mode === "now" ? new Date() : null;
      // Bij direct publiceren: ingangsdatum default = nu; bij plannen = availableFrom.
      const effectiveStart =
        startDate ?? (opts.mode === "schedule" ? availableFrom : opts.mode === "now" ? new Date() : null);

      const assignmentId = await prisma.$transaction(async (tx) => {
        let reassigned = false;
        if (opts.mode === "now") {
          reassigned = await archivePriorActive(tx, owner.tenantId, m.id);
        }
        const id = await cloneToAssignment(tx, {
          tenantId: owner.tenantId,
          userId: m.id,
          assignedById: owner.id,
          source,
          sourceTemplateId,
          status,
          availableFrom: opts.mode === "schedule" ? availableFrom : null,
          startDate: effectiveStart,
          endDate,
          trainerMessage,
          publishedAt,
        });
        return { id, reassigned };
      });

      if (opts.mode === "now") {
        publishedAssignmentIds.push(assignmentId.id);
        if (assignmentId.reassigned) result.reassigned += 1;
        else result.assigned += 1;
      } else if (opts.mode === "schedule") {
        result.scheduled += 1;
      } else {
        result.drafted += 1;
      }
    } catch (err) {
      console.error("✗ Toewijzing mislukt voor lid:", (err as Error).message);
    }
  }

  // Audit (per chunk, leesbaar): nieuw toegewezen / opnieuw toegewezen / ingepland.
  if (result.assigned > 0) {
    await audit("schema.assign", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "WorkoutTemplate",
      targetId: sourceTemplateId,
      metadata: { name: source.name, memberCount: result.assigned },
    });
  }
  if (result.reassigned > 0) {
    await audit("schema.reassign", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "WorkoutTemplate",
      targetId: sourceTemplateId,
      metadata: { name: source.name, memberCount: result.reassigned },
    });
  }
  if (result.scheduled > 0) {
    await audit("schema.schedule", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "WorkoutTemplate",
      targetId: sourceTemplateId,
      metadata: {
        name: source.name,
        memberCount: result.scheduled,
        availableFrom: availableFrom?.toLocaleString("nl-NL") ?? null,
      },
    });
  }

  // Meldingen alleen bij direct publiceren (geplande publicatie verloopt via de cron).
  if (publishedAssignmentIds.length > 0) {
    await notifyAssignmentsPublished({
      tenantId: owner.tenantId,
      assignmentIds: publishedAssignmentIds,
      origin: await origin(),
      actor: owner,
    });
  }

  revalidatePath("/owner/schemas/templates");
  return result;
}

/** Kopieer een library-template naar een lid-specifiek schema en publiceer het
 *  direct (per-lid-pagina, eenvoudige flow). */
export async function assignFromTemplate(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
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

  const { assignmentId, reassigned } = await prisma.$transaction(async (tx) => {
    const reassigned = await archivePriorActive(tx, owner.tenantId, userId);
    const id = await cloneToAssignment(tx, {
      tenantId: owner.tenantId,
      userId,
      assignedById: owner.id,
      source,
      sourceTemplateId: source.isLibrary ? source.id : null,
      status: "PUBLISHED",
      availableFrom: null,
      startDate: new Date(),
      endDate: null,
      trainerMessage: null,
      publishedAt: new Date(),
    });
    return { assignmentId: id, reassigned };
  });

  await audit(reassigned ? "schema.reassign" : "schema.assign", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "User",
    targetId: userId,
    metadata: { name: source.name, memberCount: 1, member: member.name ?? member.email },
  });

  await notifyAssignmentsPublished({
    tenantId: owner.tenantId,
    assignmentIds: [assignmentId],
    origin: await origin(),
    actor: owner,
  });

  revalidatePath(`/owner/schemas/members/${userId}`);
  redirect(`/owner/schemas/members/${userId}`);
}

/** Dupliceer een library-template (incl. dagen + oefeningen) (G3c). */
export async function duplicateTemplate(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
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
        coachNote: source.coachNote,
        validityWeeks: source.validityWeeks,
        goal: source.goal,
        badges: source.badges,
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
          notes: d.notes,
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
              tempo: it.tempo,
              params: it.params ?? undefined,
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

/** Start een leeg lid-specifiek schema voor een lid (direct gepubliceerd, geen
 *  melding — er staat nog niets in). Archiveert een vorig actief schema. */
export async function startEmptySchema(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
  const userId = String(formData.get("userId") ?? "");

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId, role: "TENANT_MEMBER" },
  });
  if (!member) redirect("/owner/schemas/members");

  await prisma.$transaction(async (tx) => {
    await archivePriorActive(tx, owner.tenantId, userId);
    const tpl = await tx.workoutTemplate.create({
      data: { tenantId: owner.tenantId, name: "Nieuw schema", isLibrary: false },
    });
    await tx.assignedWorkout.create({
      data: {
        tenantId: owner.tenantId,
        userId,
        templateId: tpl.id,
        assignedById: owner.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
        startDate: new Date(),
      },
    });
  });

  await audit("schema.assign", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "User",
    targetId: userId,
    metadata: { name: "Nieuw schema", memberCount: 1, member: member.name ?? member.email },
  });

  revalidatePath(`/owner/schemas/members/${userId}`);
  redirect(`/owner/schemas/members/${userId}`);
}

/**
 * Start een nieuw lid-specifiek schema vanuit een herbruikbare dag-template
 * (`WorkoutTemplate kind=DAY`). De ene dag van de template wordt gekloond als
 * startpunt; de coach bewerkt het schema daarna verder in de editor. Bewust
 * GEEN master-koppeling (`sourceTemplateId = null`): een dag-template is een
 * vertrekpunt, geen master om tegen te synchroniseren. En bewust GEEN melding —
 * zoals `startEmptySchema` is dit een onaf startpunt. Archiveert een vorig
 * actief schema.
 */
export async function startSchemaFromDayTemplate(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
  const userId = String(formData.get("userId") ?? "");
  const dayTemplateId = String(formData.get("dayTemplateId") ?? "");

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId, role: "TENANT_MEMBER" },
  });
  if (!member) redirect("/owner/schemas/members");

  const source = await prisma.workoutTemplate.findFirst({
    where: { id: dayTemplateId, tenantId: owner.tenantId, isLibrary: true, kind: "DAY" },
    include: sourceInclude,
  });
  if (!source) redirect(`/owner/schemas/members/${userId}`);

  await prisma.$transaction(async (tx) => {
    await archivePriorActive(tx, owner.tenantId, userId);
    await cloneToAssignment(tx, {
      tenantId: owner.tenantId,
      userId,
      assignedById: owner.id,
      source,
      sourceTemplateId: null,
      status: "PUBLISHED",
      availableFrom: null,
      startDate: new Date(),
      endDate: null,
      trainerMessage: null,
      publishedAt: new Date(),
    });
  });

  await audit("schema.assign", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "User",
    targetId: userId,
    metadata: { name: source.name, memberCount: 1, member: member.name ?? member.email },
  });

  revalidatePath(`/owner/schemas/members/${userId}`);
  redirect(`/owner/schemas/members/${userId}`);
}

/** Vind de toewijzing van een lid op id (of de actieve, als geen id). */
async function findAssignment(tenantId: string, userId: string, assignmentId?: string) {
  return prisma.assignedWorkout.findFirst({
    where: assignmentId
      ? { id: assignmentId, tenantId, userId }
      : { tenantId, userId, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: { template: { select: { id: true, name: true, isLibrary: true } } },
  });
}

/** Publiceer een concept- of gepland schema nu (zichtbaar + melding). */
export async function publishAssignment(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
  const userId = String(formData.get("userId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");

  const assignment = await findAssignment(owner.tenantId, userId, assignmentId);
  if (!assignment || assignment.status === "PUBLISHED") {
    redirect(`/owner/schemas/members/${userId}`);
  }

  await prisma.$transaction(async (tx) => {
    await archivePriorActive(tx, owner.tenantId, userId);
    await tx.assignedWorkout.update({
      where: { id: assignment.id },
      data: { status: "PUBLISHED", publishedAt: new Date(), availableFrom: null, notifiedAt: null },
    });
  });

  await audit("schema.publish", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "User",
    targetId: userId,
    metadata: { name: assignment.template?.name ?? "schema" },
  });

  await notifyAssignmentsPublished({
    tenantId: owner.tenantId,
    assignmentIds: [assignment.id],
    origin: await origin(),
    actor: owner,
  });

  revalidatePath(`/owner/schemas/members/${userId}`);
  redirect(`/owner/schemas/members/${userId}`);
}

/** Archiveer een toewijzing (uit de actieve roster, behoudt historie). */
export async function archiveAssignment(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
  const userId = String(formData.get("userId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");

  const assignment = await findAssignment(owner.tenantId, userId, assignmentId);
  if (assignment) {
    await prisma.assignedWorkout.update({
      where: { id: assignment.id },
      data: { status: "ARCHIVED" },
    });
    await audit("schema.archive", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "User",
      targetId: userId,
      metadata: { name: assignment.template?.name ?? "schema" },
    });
  }
  revalidatePath(`/owner/schemas/members/${userId}`);
  redirect(`/owner/schemas/members/${userId}`);
}

/** Verwijder een toewijzing volledig (+ lid-specifieke template-kloon). */
export async function removeAssignment(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
  const userId = String(formData.get("userId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");

  const assignment = await findAssignment(owner.tenantId, userId, assignmentId);
  if (assignment) {
    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.assignedWorkout.delete({ where: { id: assignment.id } }),
    ];
    if (assignment.template && !assignment.template.isLibrary) {
      ops.push(prisma.workoutTemplate.delete({ where: { id: assignment.template.id } }));
    }
    await prisma.$transaction(ops);
    await audit("schema.unassign", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "User",
      targetId: userId,
      metadata: { name: assignment.template?.name ?? "schema" },
    });
  }
  revalidatePath(`/owner/schemas/members/${userId}`);
  redirect(`/owner/schemas/members/${userId}`);
}

// --- Slimme synchronisatie (master ↔ persoonlijke kopie) --------------------

const cloneStructInclude = {
  days: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
} as const;

/** Prisma-update-data uit de gewijzigde velden van een master-item (getypeerd). */
function itemDataFromFields(
  after: ItemSnapshot,
  fields: ItemField[]
): Prisma.WorkoutExerciseItemUpdateInput {
  const data: Prisma.WorkoutExerciseItemUpdateInput = {};
  for (const f of fields) {
    switch (f) {
      case "sets":
        data.sets = after.sets;
        break;
      case "reps":
        data.reps = after.reps;
        break;
      case "weightKg":
        data.weightKg = after.weightKg;
        break;
      case "restSeconds":
        data.restSeconds = after.restSeconds;
        break;
      case "tempo":
        data.tempo = after.tempo;
        break;
      case "params":
        data.params = after.params === null ? Prisma.JsonNull : after.params;
        break;
      case "notes":
        data.notes = after.notes;
        break;
    }
  }
  return data;
}

/**
 * Pas één master-diff-entry toe op de persoonlijke kopie. Herlaadt de kloon vers
 * (id-stabiel ook na structurele wijzigingen). Bij `threeWay` worden waarde-
 * velden die het lid zélf heeft aangepast overgeslagen (lid wint).
 */
async function applyMasterEntry(
  tx: Prisma.TransactionClient,
  tenantId: string,
  cloneId: string,
  e: DiffEntry,
  opts: { threeWay: boolean; personalizedFields: Set<string> }
): Promise<void> {
  const clone = await tx.workoutTemplate.findUniqueOrThrow({
    where: { id: cloneId },
    include: cloneStructInclude,
  });
  let day = clone.days[e.dayIndex] ?? clone.days.find((d) => d.name === e.dayName) ?? null;

  if (e.kind === "added" && e.after) {
    if (!day) {
      day = await tx.workoutDay.create({
        data: { tenantId, templateId: cloneId, order: clone.days.length, name: e.dayName },
        include: { items: true },
      });
    }
    const maxOrder = day.items.reduce((m, it) => Math.max(m, it.order), -1);
    await tx.workoutExerciseItem.create({
      data: {
        tenantId,
        templateId: cloneId,
        dayId: day.id,
        exerciseId: e.after.exerciseId,
        order: maxOrder + 1,
        sets: e.after.sets,
        reps: e.after.reps,
        restSeconds: e.after.restSeconds,
        weightKg: e.after.weightKg,
        tempo: e.after.tempo,
        params: e.after.params ?? undefined,
        notes: e.after.notes,
      },
    });
    return;
  }

  if (!day) return; // dag bestaat niet (meer) in de kopie

  if (e.kind === "changed" && e.after && e.fields) {
    const it = day.items.find((i) => i.exerciseId === e.exerciseId);
    if (!it) return;
    const fields = opts.threeWay
      ? e.fields.filter((f) => !opts.personalizedFields.has(`${e.dayIndex}:${e.exerciseId}:${f}`))
      : e.fields;
    if (fields.length === 0) return;
    await tx.workoutExerciseItem.update({
      where: { id: it.id },
      data: itemDataFromFields(e.after, fields),
    });
  } else if (e.kind === "replaced" && e.after) {
    const it = day.items.find((i) => i.exerciseId === e.fromExerciseId);
    if (!it) return;
    await tx.workoutExerciseItem.update({
      where: { id: it.id },
      data: {
        exerciseId: e.after.exerciseId,
        sets: e.after.sets,
        reps: e.after.reps,
        restSeconds: e.after.restSeconds,
        weightKg: e.after.weightKg,
        tempo: e.after.tempo,
        params: e.after.params ?? undefined,
        notes: e.after.notes,
      },
    });
  } else if (e.kind === "removed") {
    const it = day.items.find((i) => i.exerciseId === e.exerciseId);
    if (it) await tx.workoutExerciseItem.delete({ where: { id: it.id } });
  }
}

/**
 * Synchroniseer een persoonlijke kopie met de (gewijzigde) master.
 * Modi: `all` (alle master-wijzigingen, 3-weg — lid-overrides blijven),
 * `one` (één entry via `entryId`), `dismiss` (negeren — erken de master-staat).
 */
export async function syncAssignment(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
  const userId = String(formData.get("userId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const mode = String(formData.get("mode") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  const back = `/owner/schemas/members/${userId}`;

  const assignment = await prisma.assignedWorkout.findFirst({
    where: { id: assignmentId, tenantId: owner.tenantId, userId },
    include: { template: { include: cloneStructInclude } },
  });
  if (!assignment?.sourceTemplateId || !assignment.template) redirect(back);

  const master = await prisma.workoutTemplate.findFirst({
    where: { id: assignment.sourceTemplateId, tenantId: owner.tenantId },
    include: cloneStructInclude,
  });
  if (!master) redirect(back);

  const masterSnap = snapshotOf(master);
  const name = master.name;

  if (mode === "dismiss") {
    await prisma.assignedWorkout.update({
      where: { id: assignment.id },
      data: { masterSyncedAt: master.updatedAt },
    });
    await audit("schema.sync", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "User",
      targetId: userId,
      metadata: { name, mode: "dismiss" },
    });
    revalidatePath(back);
    redirect(back);
  }

  const baseline = asSnapshot(assignment.baselineSnapshot) ?? masterSnap;
  const cloneSnap = snapshotOf(assignment.template);
  const masterDiff = diffSnapshots(baseline, masterSnap);
  const personalDiff = diffSnapshots(baseline, cloneSnap);

  // Velden die het lid zelf heeft aangepast (3-weg: lid wint).
  const personalizedFields = new Set<string>();
  for (const e of personalDiff.entries) {
    if (e.kind === "changed" && e.fields) {
      for (const f of e.fields) personalizedFields.add(`${e.dayIndex}:${e.exerciseId}:${f}`);
    }
  }

  const toApply =
    mode === "one"
      ? masterDiff.entries.filter((e) => e.id === entryId)
      : masterDiff.entries;
  if (mode === "one" && toApply.length === 0) redirect(back);

  await prisma.$transaction(async (tx) => {
    for (const e of toApply) {
      await applyMasterEntry(tx, owner.tenantId, assignment.template!.id, e, {
        threeWay: mode === "all",
        personalizedFields,
      });
    }

    if (mode === "all") {
      // Dag-notities + verwijderde dagen + coach-notitie (waar lid niet zelf wijzigde).
      const cloneNow = await tx.workoutTemplate.findUniqueOrThrow({
        where: { id: assignment.template!.id },
        include: cloneStructInclude,
      });
      for (const md of masterDiff.days) {
        if (md.status === "removed") {
          const cd = cloneNow.days[md.dayIndex] ?? cloneNow.days.find((d) => d.name === md.name);
          if (cd) await tx.workoutDay.delete({ where: { id: cd.id } });
        } else if (md.notesChanged) {
          const cd = cloneNow.days[md.dayIndex] ?? cloneNow.days.find((d) => d.name === md.name);
          const baseDayNotes = baseline.days[md.dayIndex]?.notes ?? null;
          // Lid wint: alleen overnemen als het lid de dag-notitie niet zelf wijzigde.
          if (cd && cd.notes === baseDayNotes) {
            await tx.workoutDay.update({
              where: { id: cd.id },
              data: { notes: masterSnap.days[md.dayIndex]?.notes ?? null },
            });
          }
        }
      }
      if (masterDiff.coachNoteChanged && cloneSnap.coachNote === baseline.coachNote) {
        await tx.workoutTemplate.update({
          where: { id: assignment.template!.id },
          data: { coachNote: masterSnap.coachNote },
        });
      }
      await tx.assignedWorkout.update({
        where: { id: assignment.id },
        data: { baselineSnapshot: masterSnap, masterSyncedAt: master.updatedAt },
      });
    } else {
      // Eén wijziging: werk de baseline bij zodat de rest pending blijft.
      const newBaseline = applyEntryToSnapshot(baseline, toApply[0]);
      await tx.assignedWorkout.update({
        where: { id: assignment.id },
        data: { baselineSnapshot: newBaseline },
      });
    }
  });

  await audit("schema.sync", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "User",
    targetId: userId,
    metadata: { name, mode: mode === "all" ? "all" : "one" },
  });

  revalidatePath(back);
  redirect(back);
}

// --- Bulkwijzigingen over meerdere leden ------------------------------------

const bulkOpSchema = z.object({
  type: z.enum(["weightDelta", "setRest", "addExercise", "removeExercise"]),
  delta: z.number().min(-500).max(500).optional(),
  restSeconds: z.number().int().min(0).max(600).optional(),
  exerciseId: z.string().optional().nullable(),
  sets: z.number().int().min(1).max(20).optional(),
  reps: z.number().int().min(1).max(100).optional(),
});
export type BulkOp = z.infer<typeof bulkOpSchema>;
export type BulkResult = { updated: number; skipped: number; error?: string };

/**
 * Pas één bulkwijziging toe op het actieve schema van een batch leden. Werkt op
 * de persoonlijke kopie van elk lid (de master blijft ongemoeid). Per chunk aan
 * te roepen vanuit de client → echte voortgangsbalk, schaalbaar.
 */
export async function bulkEditChunk(userIds: string[], rawOp: BulkOp): Promise<BulkResult> {
  const owner = await requirePermission("schemas:manage");
  const parsed = bulkOpSchema.safeParse(rawOp);
  if (!parsed.success) return { updated: 0, skipped: 0, error: "Ongeldige bewerking" };
  const op = parsed.data;

  const ids = [...new Set(userIds.map(String).filter(Boolean))].slice(0, 200);
  if (ids.length === 0) return { updated: 0, skipped: 0 };

  // Doel-oefening (bij toevoegen/vervangen/verwijderen) moet bij de tenant horen.
  if ((op.type === "addExercise" || op.type === "removeExercise") && op.exerciseId) {
    const exists = await prisma.exercise.count({
      where: { id: op.exerciseId, tenantId: owner.tenantId },
    });
    if (exists === 0) return { updated: 0, skipped: 0, error: "Oefening hoort niet bij deze sportschool." };
  }

  // Actieve, gepubliceerde toewijzing per lid (meest recent).
  const assignments = await prisma.assignedWorkout.findMany({
    where: { tenantId: owner.tenantId, userId: { in: ids }, status: "PUBLISHED", templateId: { not: null } },
    orderBy: { publishedAt: "desc" },
    select: { userId: true, templateId: true },
  });
  const byUser = new Map<string, string>();
  for (const a of assignments) {
    if (a.templateId && !byUser.has(a.userId)) byUser.set(a.userId, a.templateId);
  }

  let updated = 0;
  let skipped = 0;
  for (const [, templateId] of byUser) {
    try {
      if (op.type === "weightDelta" && op.delta != null) {
        const items = await prisma.workoutExerciseItem.findMany({
          where: {
            templateId,
            weightKg: { not: null },
            ...(op.exerciseId ? { exerciseId: op.exerciseId } : {}),
          },
          select: { id: true, weightKg: true },
        });
        if (items.length === 0) {
          skipped++;
          continue;
        }
        await prisma.$transaction(
          items.map((it) =>
            prisma.workoutExerciseItem.update({
              where: { id: it.id },
              data: { weightKg: Math.max(0, Math.round(((it.weightKg ?? 0) + op.delta!) * 100) / 100) },
            })
          )
        );
        updated++;
      } else if (op.type === "setRest" && op.restSeconds != null) {
        const r = await prisma.workoutExerciseItem.updateMany({
          where: { templateId, ...(op.exerciseId ? { exerciseId: op.exerciseId } : {}) },
          data: { restSeconds: op.restSeconds },
        });
        if (r.count > 0) updated++;
        else skipped++;
      } else if (op.type === "removeExercise" && op.exerciseId) {
        const r = await prisma.workoutExerciseItem.deleteMany({
          where: { templateId, exerciseId: op.exerciseId },
        });
        if (r.count > 0) updated++;
        else skipped++;
      } else if (op.type === "addExercise" && op.exerciseId) {
        const day = await prisma.workoutDay.findFirst({
          where: { templateId },
          orderBy: { order: "asc" },
          select: { id: true },
        });
        const max = await prisma.workoutExerciseItem.aggregate({
          where: { templateId, dayId: day?.id ?? null },
          _max: { order: true },
        });
        await prisma.workoutExerciseItem.create({
          data: {
            tenantId: owner.tenantId,
            templateId,
            dayId: day?.id ?? null,
            exerciseId: op.exerciseId,
            order: (max._max.order ?? -1) + 1,
            sets: op.sets ?? 3,
            reps: op.reps ?? 10,
            restSeconds: op.restSeconds ?? 60,
          },
        });
        updated++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error("✗ Bulkwijziging mislukt voor lid:", (err as Error).message);
      skipped++;
    }
  }

  if (updated > 0) {
    await audit("schema.bulk.edit", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "WorkoutTemplate",
      metadata: { memberCount: updated, op: op.type },
    });
  }

  revalidatePath("/owner/schemas/bulk");
  return { updated, skipped };
}

// --- Slimme suggestie toepassen op de master --------------------------------

/**
 * Voer een veelvoorkomende lid-aanpassing door in de master-template
 * (suggestie-id afkomstig van getMasterSuggestions). Daarna kan de coach de
 * leden re-synchroniseren. Bumpt master.updatedAt → "Sync beschikbaar".
 */
export async function applyMasterSuggestion(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
  const masterId = String(formData.get("masterId") ?? "");
  const suggestionId = String(formData.get("suggestionId") ?? "");
  const back = `/owner/schemas/templates/${masterId}`;

  const parts = suggestionId.split(":");
  const kind = parts[0];
  const dayIndex = Number(parts[1]);
  if (!masterId || Number.isNaN(dayIndex)) redirect(back);

  const master = await prisma.workoutTemplate.findFirst({
    where: { id: masterId, tenantId: owner.tenantId, isLibrary: true },
    include: cloneStructInclude,
  });
  if (!master) redirect(back);
  const day = master.days[dayIndex];
  if (!day) redirect(back);

  if (kind === "replace") {
    const fromId = parts[2];
    const toId = parts[3];
    const ok = await prisma.exercise.count({ where: { id: toId, tenantId: owner.tenantId } });
    const item = day.items.find((i) => i.exerciseId === fromId);
    if (ok > 0 && item) {
      await prisma.workoutExerciseItem.update({
        where: { id: item.id },
        data: { exerciseId: toId },
      });
    }
  } else if (kind === "remove") {
    const exId = parts[2];
    const item = day.items.find((i) => i.exerciseId === exId);
    if (item) await prisma.workoutExerciseItem.delete({ where: { id: item.id } });
  } else if (kind === "add") {
    const exId = parts[2];
    const ok = await prisma.exercise.count({ where: { id: exId, tenantId: owner.tenantId } });
    if (ok > 0 && !day.items.some((i) => i.exerciseId === exId)) {
      const maxOrder = day.items.reduce((m, it) => Math.max(m, it.order), -1);
      await prisma.workoutExerciseItem.create({
        data: {
          tenantId: owner.tenantId,
          templateId: masterId,
          dayId: day.id,
          exerciseId: exId,
          order: maxOrder + 1,
          sets: 3,
          reps: 10,
          restSeconds: 60,
        },
      });
    }
  } else {
    redirect(back);
  }

  // Bump updatedAt zodat toewijzingen "Sync beschikbaar" tonen.
  await prisma.workoutTemplate.update({
    where: { id: masterId },
    data: { updatedAt: new Date() },
  });

  await audit("schema.master.apply", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "WorkoutTemplate",
    targetId: masterId,
    metadata: { name: master.name, kind },
  });

  revalidatePath(back);
  redirect(back);
}

/** Geef een library-template vrij (of verberg) als lid-startsjabloon. */
export async function setTemplateMemberVisible(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
  const id = String(formData.get("id") ?? "");
  const visible = formData.get("visible") === "true";

  const { count } = await prisma.workoutTemplate.updateMany({
    where: { id, tenantId: owner.tenantId, isLibrary: true, kind: "SCHEMA" },
    data: { memberVisible: visible },
  });
  if (count > 0) {
    await audit("schema.update", {
      actor: owner,
      tenantId: owner.tenantId,
      targetType: "WorkoutTemplate",
      targetId: id,
      metadata: { memberVisible: visible },
    });
  }
  revalidatePath(`/owner/schemas/templates/${id}`);
}

// --- Zelf-gebouwde lid-schema's: coach-review ------------------------------

const reviewSchema = z.object({
  assignmentId: z.string().min(1),
  decision: z.enum(["approve", "reject", "approve_activate"]),
  reviewNote: z.string().trim().max(1000).optional().nullable(),
});

/**
 * Keur een door een lid zelf-gebouwd schema goed of af. `approve` → APPROVED
 * (lid activeert zelf); `approve_activate` → ook meteen activeren namens het lid;
 * `reject` → REJECTED (+ reden). Informeert het lid (in-app + e-mail).
 */
export async function reviewMemberSchema(formData: FormData) {
  const owner = await requirePermission("schemas:manage");
  const parsed = reviewSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    decision: formData.get("decision"),
    reviewNote: formData.get("reviewNote"),
  });
  const back = "/owner/schemas/member-built";
  if (!parsed.success) redirect(back);
  const { assignmentId, decision, reviewNote } = parsed.data;

  const assignment = await prisma.assignedWorkout.findFirst({
    where: { id: assignmentId, tenantId: owner.tenantId, origin: "MEMBER" },
    include: {
      template: { select: { name: true } },
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!assignment?.template) redirect(back);

  const schemaName = assignment.template.name;
  const approved = decision === "approve" || decision === "approve_activate";
  const note = reviewNote?.trim() || null;

  if (approved) {
    await prisma.$transaction(async (tx) => {
      await tx.assignedWorkout.update({
        where: { id: assignment.id },
        data: {
          memberStatus: "APPROVED",
          reviewedAt: new Date(),
          reviewedById: owner.id,
          reviewNote: note,
        },
      });
      if (decision === "approve_activate") {
        // Archiveer het huidige actieve schema van het lid en zet dit live.
        await tx.assignedWorkout.updateMany({
          where: {
            tenantId: owner.tenantId,
            userId: assignment.userId,
            status: "PUBLISHED",
            id: { not: assignment.id },
          },
          data: { status: "ARCHIVED" },
        });
        await tx.assignedWorkout.update({
          where: { id: assignment.id },
          data: {
            memberStatus: "ACTIVE",
            status: "PUBLISHED",
            publishedAt: new Date(),
            availableFrom: null,
          },
        });
      }
    });
  } else {
    await prisma.assignedWorkout.update({
      where: { id: assignment.id },
      data: {
        memberStatus: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: owner.id,
        reviewNote: note,
      },
    });
  }

  await audit(approved ? "schema.member.approve" : "schema.member.reject", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "AssignedWorkout",
    targetId: assignment.id,
    metadata: { name: schemaName, member: assignment.user.name ?? assignment.user.email },
  });

  await notifyMemberSchemaReviewed({
    tenantId: owner.tenantId,
    memberId: assignment.user.id,
    memberEmail: assignment.user.email,
    memberName: assignment.user.name,
    approved,
    schemaName,
    reviewNote: note,
    viewUrl: `${await origin()}/member/schema/builder`,
  });

  revalidatePath(back);
  redirect(back);
}
