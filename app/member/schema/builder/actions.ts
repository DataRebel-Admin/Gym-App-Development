"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { audit } from "@/lib/audit";
import { withFavoriteIds } from "@/lib/user-preferences";
import { isExerciseType, DEFAULT_EXERCISE_TYPE } from "@/lib/exercise-types";
import { paramsFromInputValues, itemColumnsFromParams } from "@/lib/exercise-params";
import {
  requireMemberSchemaEnabled,
  resolveFramework,
} from "@/lib/member-schema";
import { validateAgainstFramework, type ConstraintDay } from "@/lib/member-schema-constraints";
import { requiresApproval } from "@/lib/member-schema-status";
import { getBlueprint } from "@/lib/member-schema-blueprints";
import {
  notifyMemberSchemaSubmitted,
  emailCoachesSchemaSubmitted,
} from "@/lib/member-schema-notify";

export type MemberSchemaSaveState = { error?: string; ok?: boolean; violations?: string[] };

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Serialisatie-contract identiek aan de owner-editor (components/schema-editor.tsx
// + app/owner/schemas/actions.ts) zodat de type-bewuste opslag herbruikbaar is.
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

const GOALS = ["MUSCLE", "WEIGHT_LOSS", "CONDITION", "REHAB", "STRENGTH", "OTHER"] as const;

/** Valideer dat alle exerciseIds tot deze tenant horen (en niet gearchiveerd). */
async function assertExercisesInTenant(tenantId: string, ids: string[]) {
  if (ids.length === 0) return;
  const count = await prisma.exercise.count({
    where: { tenantId, id: { in: ids }, archivedAt: null },
  });
  if (count !== new Set(ids).size) {
    throw new Error("Eén of meer oefeningen horen niet bij deze sportschool.");
  }
}

/**
 * Start een nieuw zelf-gebouwd schema: leeg, vanuit een blueprint of vanuit een
 * door de owner vrijgegeven library-template. Maakt een niet-library
 * WorkoutTemplate (concept) + AssignedWorkout(origin=MEMBER, DRAFT) en gaat naar
 * de editor.
 */
export async function startMemberSchema(formData: FormData) {
  const member = await requireMember();
  await requireMemberSchemaEnabled(member.tenantId);

  const source = String(formData.get("source") ?? "scratch");
  const goalRaw = String(formData.get("goal") ?? "");
  const goal = (GOALS as readonly string[]).includes(goalRaw)
    ? (goalRaw as (typeof GOALS)[number])
    : null;
  const focusNote = String(formData.get("focusNote") ?? "").trim().slice(0, 500) || null;

  const framework = await resolveFramework(member.tenantId, member.id);

  // Bepaal naam + dag-structuur op basis van de bron.
  let name = "Mijn schema";
  let dayNames: string[] = ["Dag 1"];
  let clonedFrom:
    | Prisma.WorkoutTemplateGetPayload<{
        include: { days: { include: { items: true } } };
      }>
    | null = null;

  if (source.startsWith("template:")) {
    const templateId = source.slice("template:".length);
    clonedFrom = await prisma.workoutTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: member.tenantId,
        isLibrary: true,
        memberVisible: true,
        kind: "SCHEMA",
      },
      include: { days: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } } },
    });
    if (!clonedFrom) redirect("/member/schema/builder/new");
    name = `${clonedFrom.name} (mijn versie)`;
  } else if (source.startsWith("blueprint:")) {
    const bp = getBlueprint(source.slice("blueprint:".length));
    if (bp && bp.key !== "scratch") {
      name = bp.label;
      dayNames = bp.days;
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const tpl = await tx.workoutTemplate.create({
      data: {
        tenantId: member.tenantId,
        name,
        description: clonedFrom?.description ?? null,
        isLibrary: false,
      },
    });

    if (clonedFrom) {
      for (const d of clonedFrom.days) {
        await tx.workoutDay.create({
          data: {
            tenantId: member.tenantId,
            templateId: tpl.id,
            order: d.order,
            name: d.name,
            notes: d.notes,
            items: {
              create: d.items.map((it) => ({
                tenantId: member.tenantId,
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
    } else {
      await Promise.all(
        dayNames.map((dn, i) =>
          tx.workoutDay.create({
            data: { tenantId: member.tenantId, templateId: tpl.id, order: i, name: dn },
          })
        )
      );
    }

    const assignment = await tx.assignedWorkout.create({
      data: {
        tenantId: member.tenantId,
        userId: member.id,
        templateId: tpl.id,
        assignedById: member.id,
        origin: "MEMBER",
        memberStatus: "DRAFT",
        status: "DRAFT",
        goal,
        focusNote,
        frameworkId: framework?.id ?? null,
      },
    });
    return assignment;
  });

  await audit("schema.member.start", {
    actor: { id: member.id, email: member.email, role: member.role },
    tenantId: member.tenantId,
    targetType: "AssignedWorkout",
    targetId: created.id,
    metadata: { name },
  });

  redirect(`/member/schema/builder/${created.id}`);
}

/**
 * Persisteer de favoriete oefeningen van het lid (User.preferences). Lichtgewicht
 * (geen revalidate/redirect) — de builder roept dit optimistisch aan.
 */
export async function setFavoriteExercises(ids: string[]): Promise<{ ok: boolean }> {
  const member = await requireMember();
  const clean = [...new Set(ids.map(String).filter(Boolean))].slice(0, 100);
  // Valideer dat het oefeningen van deze tenant zijn.
  const valid = await prisma.exercise.findMany({
    where: { tenantId: member.tenantId, id: { in: clean } },
    select: { id: true },
  });
  const validIds = valid.map((e) => e.id);

  const user = await prisma.user.findUnique({
    where: { id: member.id },
    select: { preferences: true },
  });
  await prisma.user.update({
    where: { id: member.id },
    data: { preferences: withFavoriteIds(user?.preferences, validIds) },
  });
  return { ok: true };
}

/** Haal een bewerkbaar (DRAFT/REJECTED) zelf-schema van dit lid op. */
async function loadEditableAssignment(id: string, memberId: string, tenantId: string) {
  return prisma.assignedWorkout.findFirst({
    where: { id, tenantId, userId: memberId, origin: "MEMBER" },
    include: { template: { select: { id: true, name: true } } },
  });
}

type PersistResult =
  | { ok: true; assignmentId: string; schemaName: string; itemCount: number }
  | { ok: false; error: string; violations?: string[] };

/**
 * Kern: valideer + persisteer een concept (naam/beschrijving/dagen) van dit lid.
 * `enforceMinimums` = false tijdens autosave, true bij indienen/activeren. Gedeeld
 * door saveMemberDraft en submitMemberSchema (voorkomt een save-race bij indienen).
 */
async function persistDraft(
  member: { id: string; tenantId: string },
  formData: FormData,
  opts: { enforceMinimums: boolean }
): Promise<PersistResult> {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { ok: false, error: "Geef je schema een naam" };

  const assignment = await loadEditableAssignment(assignmentId, member.id, member.tenantId);
  if (!assignment || !assignment.template) return { ok: false, error: "Schema niet gevonden" };
  if (assignment.memberStatus !== "DRAFT" && assignment.memberStatus !== "REJECTED") {
    return { ok: false, error: "Dit schema kan niet meer bewerkt worden" };
  }

  let days;
  try {
    days = daysSchema.parse(JSON.parse(String(formData.get("days") ?? "[]")));
  } catch {
    return { ok: false, error: "Ongeldige schema-indeling" };
  }

  try {
    await assertExercisesInTenant(
      member.tenantId,
      days.flatMap((d) => d.items.map((i) => i.exerciseId))
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Validatiefout" };
  }

  // Kader-validatie (autoritatief — nooit de client vertrouwen).
  const framework = await resolveFramework(member.tenantId, member.id);
  const constraintDays: ConstraintDay[] = days.map((d) => ({
    items: d.items.map((i) => ({
      exerciseId: i.exerciseId,
      exerciseType: i.exerciseType,
      values: i.values,
    })),
  }));
  const check = validateAgainstFramework(constraintDays, framework?.limits ?? null, {
    enforceMinimums: opts.enforceMinimums,
  });
  if (!check.ok) return { ok: false, error: check.violations[0], violations: check.violations };

  const templateId = assignment.template.id;
  await prisma.$transaction([
    prisma.workoutTemplate.update({
      where: { id: templateId },
      data: { name, description: description || null },
    }),
    prisma.workoutExerciseItem.deleteMany({ where: { templateId } }),
    prisma.workoutDay.deleteMany({ where: { templateId } }),
    ...days.map((d, dayIdx) =>
      prisma.workoutDay.create({
        data: {
          tenantId: member.tenantId,
          templateId,
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
                tenantId: member.tenantId,
                templateId,
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

  const itemCount = days.reduce((n, d) => n + d.items.length, 0);
  return { ok: true, assignmentId, schemaName: name, itemCount };
}

/**
 * Sla het concept op (autosave). Alleen op eigen DRAFT/REJECTED-schema; valideert
 * autoritatief tegen de kaders (harde grenzen; minimums pas bij indienen).
 */
export async function saveMemberDraft(
  _prev: MemberSchemaSaveState,
  formData: FormData
): Promise<MemberSchemaSaveState> {
  const member = await requireMember();
  await requireMemberSchemaEnabled(member.tenantId);
  const res = await persistDraft(member, formData, { enforceMinimums: false });
  if (!res.ok) return { error: res.error, violations: res.violations };
  revalidatePath(`/member/schema/builder/${res.assignmentId}`);
  return { ok: true };
}

/** Archiveer het huidige actieve schema van een lid (coach- of zelf-gebouwd). */
async function archivePriorActive(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string
) {
  // Actief zelf-schema → gepauzeerd (behoudt de member-levenscyclus).
  await tx.assignedWorkout.updateMany({
    where: { tenantId, userId, origin: "MEMBER", memberStatus: "ACTIVE", status: "PUBLISHED" },
    data: { memberStatus: "PAUSED", status: "ARCHIVED" },
  });
  // Actief coach-schema → gearchiveerd.
  await tx.assignedWorkout.updateMany({
    where: { tenantId, userId, origin: "COACH", status: "PUBLISHED" },
    data: { status: "ARCHIVED" },
  });
}

/** Zet een zelf-schema live (zichtbaar in de trainingsomgeving). */
async function activate(
  tenantId: string,
  userId: string,
  assignmentId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await archivePriorActive(tx, tenantId, userId);
    await tx.assignedWorkout.update({
      where: { id: assignmentId },
      data: {
        memberStatus: "ACTIVE",
        status: "PUBLISHED",
        publishedAt: new Date(),
        availableFrom: null,
        seenAt: new Date(), // lid heeft z'n eigen schema al gezien
      },
    });
  });
}

/**
 * Sla het concept op én dien het in. Bij APPROVAL → IN_REVIEW + melding naar
 * coaches; bij DIRECT → direct activeren. Handhaaft de kaders (incl. minimums)
 * autoritatief. Retourneert een validatiefout of redirect na succes.
 */
export async function submitMemberSchema(
  _prev: MemberSchemaSaveState,
  formData: FormData
): Promise<MemberSchemaSaveState> {
  const member = await requireMember();
  const mode = await requireMemberSchemaEnabled(member.tenantId);

  // Persisteer eerst de laatste staat (voorkomt een save-race bij indienen).
  const saved = await persistDraft(member, formData, { enforceMinimums: true });
  if (!saved.ok) return { error: saved.error, violations: saved.violations };
  if (saved.itemCount === 0) {
    return { error: "Voeg minstens één oefening toe voordat je indient." };
  }

  const assignmentId = saved.assignmentId;
  const schemaName = saved.schemaName;
  const framework = await resolveFramework(member.tenantId, member.id);
  const needsApproval = requiresApproval(mode, framework?.requireApproval);
  const actor = { id: member.id, email: member.email, role: member.role };

  if (needsApproval) {
    await prisma.assignedWorkout.update({
      where: { id: assignmentId },
      data: { memberStatus: "IN_REVIEW", submittedAt: new Date(), reviewNote: null },
    });
    await audit("schema.member.submit", {
      actor,
      tenantId: member.tenantId,
      targetType: "AssignedWorkout",
      targetId: assignmentId,
      metadata: { name: schemaName },
    });
    const base = await origin();
    const reviewLink = `/owner/schemas/member-built`;
    await notifyMemberSchemaSubmitted({
      tenantId: member.tenantId,
      memberName: member.name ?? member.email ?? "Een lid",
      schemaName,
      reviewLink,
    });
    await emailCoachesSchemaSubmitted({
      tenantId: member.tenantId,
      memberName: member.name ?? member.email ?? "Een lid",
      schemaName,
      reviewUrl: `${base}${reviewLink}`,
    });
    redirect(`/member/schema/builder?submitted=1`);
  }

  // DIRECT: meteen activeren.
  await activate(member.tenantId, member.id, assignmentId);
  await audit("schema.member.activate", {
    actor,
    tenantId: member.tenantId,
    targetType: "AssignedWorkout",
    targetId: assignmentId,
    metadata: { name: schemaName },
  });
  redirect(`/member/schema?activated=1`);
}

/** Activeer een goedgekeurd (of DIRECT) zelf-schema om ermee te trainen. */
export async function activateMemberSchema(formData: FormData) {
  const member = await requireMember();
  await requireMemberSchemaEnabled(member.tenantId);
  const assignmentId = String(formData.get("assignmentId") ?? "");

  const assignment = await prisma.assignedWorkout.findFirst({
    where: { id: assignmentId, tenantId: member.tenantId, userId: member.id, origin: "MEMBER" },
    include: { template: { select: { name: true } } },
  });
  if (!assignment) redirect("/member/schema/builder");
  // Alleen goedgekeurde of (bij DIRECT) reeds gepauzeerde/afgeronde schema's.
  if (assignment.memberStatus !== "APPROVED" && assignment.memberStatus !== "PAUSED") {
    redirect(`/member/schema/builder`);
  }

  await activate(member.tenantId, member.id, assignment.id);
  await audit("schema.member.activate", {
    actor: { id: member.id, email: member.email, role: member.role },
    tenantId: member.tenantId,
    targetType: "AssignedWorkout",
    targetId: assignment.id,
    metadata: { name: assignment.template?.name ?? "schema" },
  });
  redirect(`/member/schema?activated=1`);
}

/** Pauzeer het actieve zelf-schema (uit de trainingsomgeving). */
export async function pauseMemberSchema(formData: FormData) {
  const member = await requireMember();
  await requireMemberSchemaEnabled(member.tenantId);
  const assignmentId = String(formData.get("assignmentId") ?? "");

  const assignment = await prisma.assignedWorkout.findFirst({
    where: {
      id: assignmentId,
      tenantId: member.tenantId,
      userId: member.id,
      origin: "MEMBER",
      memberStatus: "ACTIVE",
    },
    include: { template: { select: { name: true } } },
  });
  if (!assignment) redirect("/member/schema/builder");

  await prisma.assignedWorkout.update({
    where: { id: assignment.id },
    data: { memberStatus: "PAUSED", status: "ARCHIVED" },
  });
  await audit("schema.member.pause", {
    actor: { id: member.id, email: member.email, role: member.role },
    tenantId: member.tenantId,
    targetType: "AssignedWorkout",
    targetId: assignment.id,
    metadata: { name: assignment.template?.name ?? "schema" },
  });
  revalidatePath("/member/schema/builder");
  redirect("/member/schema/builder");
}

/** Verwijder een eigen concept (of afgewezen schema) volledig. */
export async function deleteMemberSchema(formData: FormData) {
  const member = await requireMember();
  await requireMemberSchemaEnabled(member.tenantId);
  const assignmentId = String(formData.get("assignmentId") ?? "");

  const assignment = await prisma.assignedWorkout.findFirst({
    where: { id: assignmentId, tenantId: member.tenantId, userId: member.id, origin: "MEMBER" },
    select: { id: true, templateId: true, memberStatus: true },
  });
  // Alleen concept/afgewezen mogen weg; actieve/ingediende niet (behoud controle).
  if (
    !assignment ||
    (assignment.memberStatus !== "DRAFT" && assignment.memberStatus !== "REJECTED")
  ) {
    redirect("/member/schema/builder");
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.assignedWorkout.delete({ where: { id: assignment.id } }),
  ];
  if (assignment.templateId) {
    ops.push(prisma.workoutTemplate.delete({ where: { id: assignment.templateId } }));
  }
  await prisma.$transaction(ops);

  revalidatePath("/member/schema/builder");
  redirect("/member/schema/builder");
}
