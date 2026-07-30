"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { AssignmentOrigin, MemberSchemaStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { audit } from "@/lib/audit";
import { withFavoriteIds } from "@/lib/user-preferences";
import { isExerciseType, DEFAULT_EXERCISE_TYPE } from "@/lib/exercise-types";
import { normalizeGroupColumns } from "@/lib/exercise-groups";
import { paramsFromInputValues, itemColumnsFromParams } from "@/lib/exercise-params";
import {
  requireMemberSchemaEnabled,
  getMemberSchemaMode,
  canEditAssignedSchema,
  resolveFramework,
} from "@/lib/member-schema";
import { validateAgainstFramework, type ConstraintDay } from "@/lib/member-schema-constraints";
import {
  requiresApproval,
  isEditableMemberStatus,
  isCommittedMemberStatus,
  statusAfterWithdraw,
} from "@/lib/member-schema-status";
import { getBlueprint } from "@/lib/member-schema-blueprints";
import { MEMBER_LIBRARY_WHERE } from "@/lib/member-library-rules";
import { coverUrlForCopy } from "@/lib/schema-image";
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
  // Coach-boodschap per oefening: het lid bewerkt 'm niet, maar de editor stuurt
  // 'm ongewijzigd terug zodat een bewerkronde de notitie van de coach niet wist.
  memberNote: z.string().trim().max(280).nullable().optional(),
  // Groeperen (superset/giant/circuit/AMRAP) + dropset — pariteit met de owner-editor.
  groupId: z.string().trim().max(64).nullable().optional(),
  groupType: z.string().trim().max(20).nullable().optional(),
  groupOrder: z.coerce.number().int().min(0).max(60).optional(),
  groupRounds: z.coerce.number().int().min(1).max(50).nullable().optional(),
  groupRestSeconds: z.coerce.number().int().min(0).max(3600).nullable().optional(),
  groupLabel: z.string().trim().max(60).nullable().optional(),
  groupTimeCapSeconds: z.coerce.number().int().min(0).max(36000).nullable().optional(),
  dropsetCount: z.coerce.number().int().min(0).max(10).nullable().optional(),
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
      // Autoritatieve hercontrole van de bron: dezelfde where als het
      // library-overzicht (nooit de client vertrouwen). Zie
      // lib/member-library-rules.ts voor waarom dit één constante is.
      where: { id: templateId, tenantId: member.tenantId, ...MEMBER_LIBRARY_WHERE },
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
        // Neem het beeld van het sjabloon over, zodat "mijn versie" er in de
        // lijst hetzelfde uitziet als het schema waar het lid mee begon.
        imageUrl: clonedFrom ? coverUrlForCopy(clonedFrom) : null,
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
                // memberNote bewust niet (coach-only); groep/dropset wél behouden.
                groupId: it.groupId,
                groupType: it.groupType,
                groupOrder: it.groupOrder,
                groupRounds: it.groupRounds,
                groupRestSeconds: it.groupRestSeconds,
                groupLabel: it.groupLabel,
                groupTimeCapSeconds: it.groupTimeCapSeconds,
                dropsetCount: it.dropsetCount,
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

/**
 * Haal een schema van dit lid op (eigenaarschap + tenant gescoped). Kan zowel een
 * zelf-gebouwd schema zijn als een door de trainer toegewezen schema — welke
 * regels gelden bepaalt `assertEditAllowed` hieronder.
 */
async function loadOwnAssignment(id: string, memberId: string, tenantId: string) {
  return prisma.assignedWorkout.findFirst({
    where: { id, tenantId, userId: memberId },
    include: { template: { select: { id: true, name: true } } },
  });
}

/**
 * Mag dit lid dit schema nú bewerken? Retourneert een leesbare reden of null.
 *
 * Twee losse poorten, bewust niet samengevoegd:
 * - **zelf-gebouwd** (`origin=MEMBER`): `Tenant.memberSchemaMode` moet aan staan
 *   en de lid-status moet bewerkbaar zijn (niet in beoordeling).
 * - **toegewezen** (`origin=COACH`): `Tenant.memberCanEditAssigned` moet aan
 *   staan. Er is géén lid-levenscyclus (memberStatus is null) — het schema staat
 *   al live en blijft van de coach; het lid past zijn eigen kopie aan.
 */
async function assertEditAllowed(
  tenantId: string,
  assignment: { origin: AssignmentOrigin; memberStatus: MemberSchemaStatus | null }
): Promise<string | null> {
  if (assignment.origin === "MEMBER") {
    const mode = await getMemberSchemaMode(tenantId);
    if (mode === "DISABLED") {
      return "Zelf schema's samenstellen staat uit bij je sportschool.";
    }
    if (!isEditableMemberStatus(assignment.memberStatus ?? "DRAFT")) {
      return "Je coach beoordeelt dit schema. Trek je indiening in om verder te bewerken.";
    }
    return null;
  }
  if (!(await canEditAssignedSchema(tenantId))) {
    return "Je sportschool laat niet toe dat je een toegewezen schema zelf aanpast.";
  }
  return null;
}

type PersistResult =
  | {
      ok: true;
      assignmentId: string;
      schemaName: string;
      itemCount: number;
      /** Lid-status vóór deze bewerking (DRAFT/REJECTED/APPROVED/ACTIVE/PAUSED). */
      status: MemberSchemaStatus;
      /** Stond dit schema live in de trainingsomgeving? */
      isLive: boolean;
      /** Zelf gebouwd (MEMBER) of door de trainer toegewezen (COACH)? */
      origin: AssignmentOrigin;
    }
  | { ok: false; error: string; violations?: string[] };

/**
 * Kern: valideer + persisteer het schema (naam/beschrijving/dagen) van dit lid.
 * `enforceMinimums` = false tijdens autosave, true bij indienen/activeren. Gedeeld
 * door saveMemberDraft en submitMemberSchema (voorkomt een save-race bij indienen).
 *
 * Werkt op élk bewerkbaar eigen schema — óók een goedgekeurd/actief schema. De
 * zichtbaarheidspoort (`AssignedWorkout.status`) blijft daarbij ongemoeid: een
 * lopend schema blijft trainbaar terwijl het lid eraan werkt. De statusovergang
 * (opnieuw ter controle / activeren) gebeurt bewust alleen in de expliciete
 * commit-stap, zodat autosave het schema nooit halverwege op slot zet.
 */
async function persistDraft(
  member: { id: string; tenantId: string; email?: string | null; role?: Role | null },
  formData: FormData,
  opts: { enforceMinimums: boolean }
): Promise<PersistResult> {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { ok: false, error: "Geef je schema een naam" };

  const assignment = await loadOwnAssignment(assignmentId, member.id, member.tenantId);
  if (!assignment || !assignment.template) return { ok: false, error: "Schema niet gevonden" };
  const status = assignment.memberStatus ?? "DRAFT";
  const assigned = assignment.origin === "COACH";
  const blocked = await assertEditAllowed(member.tenantId, assignment);
  if (blocked) return { ok: false, error: blocked };

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

  // Kader-validatie (autoritatief — nooit de client vertrouwen). Kaders begrenzen
  // wat een lid zélf mag bouwen; op een schema van de trainer is de coach leidend.
  // Ze hier toch toepassen zou het lid buitensluiten van z'n eigen opslag zodra de
  // coach iets voorschreef dat buiten het kader valt (6 sets waar max 4 mag, meer
  // dagen dan toegestaan, een niet-vrijgegeven oefening).
  const framework = assigned ? null : await resolveFramework(member.tenantId, member.id);
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
                // Coach-notitie behouden (zie itemSchema) — nooit stil wissen.
                memberNote: it.memberNote?.trim() ? it.memberNote.trim() : null,
                ...normalizeGroupColumns(it),
              };
            }),
          },
        },
      })
    ),
  ]);

  const itemCount = days.reduce((n, d) => n + d.items.length, 0);

  // Het lid past het schema van zijn trainer aan: dat is een gebeurtenis die de
  // sportschool moet kunnen terugzien. Zelf-gebouwde concepten loggen we niet
  // (te veel ruis); dit spiegelt `schema.update` van de owner-editor.
  if (assigned) {
    await audit("schema.member.edit", {
      actor: { id: member.id, email: member.email, role: member.role },
      tenantId: member.tenantId,
      targetType: "AssignedWorkout",
      targetId: assignmentId,
      metadata: { name, days: days.length, items: itemCount },
    });
  }

  return {
    ok: true,
    assignmentId,
    schemaName: name,
    itemCount,
    status,
    isLive: assignment.status === "PUBLISHED",
    origin: assignment.origin,
  };
}

/**
 * Sla het schema op (autosave). Alleen op een eigen, bewerkbaar schema; valideert
 * autoritatief tegen de kaders (harde grenzen; minimums pas bij indienen).
 */
export async function saveMemberDraft(
  _prev: MemberSchemaSaveState,
  formData: FormData
): Promise<MemberSchemaSaveState> {
  const member = await requireMember();
  // Géén blanket `requireMemberSchemaEnabled` meer: een toegewezen schema bewerken
  // heeft z'n eigen poort. persistDraft → assertEditAllowed gate't per herkomst.
  const res = await persistDraft(member, formData, { enforceMinimums: false });
  if (!res.ok) return { error: res.error, violations: res.violations };
  revalidatePath(`/member/schema/builder/${res.assignmentId}`);
  // Een live schema bewerken werkt direct door in de trainingsomgeving.
  if (res.isLive) revalidatePath("/member/schema");
  return { ok: true };
}

/**
 * Archiveer het huidige actieve schema van een lid (coach- of zelf-gebouwd).
 * `exceptId` = het schema dat juist live gezet wordt — dat mag zichzelf niet
 * pauzeren (relevant bij het opnieuw vastleggen van een al actief zelf-schema).
 */
async function archivePriorActive(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  exceptId: string
) {
  // Actief zelf-schema → gepauzeerd (behoudt de member-levenscyclus).
  await tx.assignedWorkout.updateMany({
    where: {
      tenantId,
      userId,
      origin: "MEMBER",
      memberStatus: "ACTIVE",
      status: "PUBLISHED",
      id: { not: exceptId },
    },
    data: { memberStatus: "PAUSED", status: "ARCHIVED" },
  });
  // Actief coach-schema → gearchiveerd.
  await tx.assignedWorkout.updateMany({
    where: { tenantId, userId, origin: "COACH", status: "PUBLISHED", id: { not: exceptId } },
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
    await archivePriorActive(tx, tenantId, userId, assignmentId);
    const current = await tx.assignedWorkout.findUnique({
      where: { id: assignmentId },
      select: { status: true, publishedAt: true },
    });
    // Al live? Behoud de oorspronkelijke publicatiedatum — die is de nullijn voor
    // voortgang (getSchemaProgress) en geldigheid; een bewerkronde mag die niet
    // resetten.
    const wasLive = current?.status === "PUBLISHED" && current.publishedAt != null;
    await tx.assignedWorkout.update({
      where: { id: assignmentId },
      data: {
        memberStatus: "ACTIVE",
        status: "PUBLISHED",
        publishedAt: wasLive ? current!.publishedAt : new Date(),
        availableFrom: null,
        seenAt: new Date(), // lid heeft z'n eigen schema al gezien
      },
    });
  });
}

/**
 * Sla het schema op én leg het vast. Bij APPROVAL → IN_REVIEW + melding naar
 * coaches; bij DIRECT → direct activeren. Handhaaft de kaders (incl. minimums)
 * autoritatief. Retourneert een validatiefout of redirect na succes.
 *
 * Ook de commit-stap van een **bewerkt, al vastgelegd** schema loopt hierlangs:
 * een lopend schema blijft dan zichtbaar (`status` = PUBLISHED blijft staan)
 * terwijl `memberStatus` naar IN_REVIEW gaat — het lid kan dus blijven trainen
 * terwijl de coach de wijziging bekijkt.
 */
export async function submitMemberSchema(
  _prev: MemberSchemaSaveState,
  formData: FormData
): Promise<MemberSchemaSaveState> {
  const member = await requireMember();

  // Persisteer eerst de laatste staat (voorkomt een save-race bij indienen).
  const saved = await persistDraft(member, formData, { enforceMinimums: true });
  if (!saved.ok) return { error: saved.error, violations: saved.violations };
  if (saved.itemCount === 0) {
    return { error: "Voeg minstens één oefening toe voordat je indient." };
  }

  // Een toegewezen schema kent geen indien-/activeerstap: het staat al live en
  // blijft van de coach. Opslaan is dus het hele verhaal. (De editor toont hier
  // geen indienknop; deze guard is defense-in-depth.)
  if (saved.origin === "COACH") {
    revalidatePath("/member/schema");
    redirect("/member/schema");
  }

  const mode = await requireMemberSchemaEnabled(member.tenantId);
  const assignmentId = saved.assignmentId;
  const schemaName = saved.schemaName;
  const framework = await resolveFramework(member.tenantId, member.id);
  const needsApproval = requiresApproval(mode, framework?.requireApproval);
  // Een herziening = commit op een schema dat al goedgekeurd/in gebruik was.
  const isRevision = isCommittedMemberStatus(saved.status);
  const actor = { id: member.id, email: member.email, role: member.role };

  if (needsApproval) {
    await prisma.assignedWorkout.update({
      where: { id: assignmentId },
      // `status` (zichtbaarheid) bewust ongemoeid: een lopend schema blijft
      // trainbaar tijdens de herbeoordeling.
      data: { memberStatus: "IN_REVIEW", submittedAt: new Date(), reviewNote: null },
    });
    await audit("schema.member.submit", {
      actor,
      tenantId: member.tenantId,
      targetType: "AssignedWorkout",
      targetId: assignmentId,
      metadata: { name: schemaName, revision: isRevision },
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
    revalidatePath("/member/schema/builder");
    if (saved.isLive) revalidatePath("/member/schema");
    redirect(`/member/schema/builder?submitted=1${isRevision ? "&revision=1" : ""}`);
  }

  // DIRECT: meteen activeren.
  await activate(member.tenantId, member.id, assignmentId);
  await audit("schema.member.activate", {
    actor,
    tenantId: member.tenantId,
    targetType: "AssignedWorkout",
    targetId: assignmentId,
    metadata: { name: schemaName, revision: isRevision },
  });
  revalidatePath("/member/schema");
  redirect(`/member/schema?activated=1`);
}

/**
 * Trek een indiening in: het schema komt terug in de staat van vóór het indienen
 * (actief blijft actief, gepauzeerd blijft gepauzeerd, de rest wordt concept) en
 * is weer bewerkbaar. Zo zit een lid nooit vast te wachten op de coach.
 */
export async function withdrawMemberSchema(formData: FormData) {
  const member = await requireMember();
  await requireMemberSchemaEnabled(member.tenantId);
  const assignmentId = String(formData.get("assignmentId") ?? "");

  const assignment = await prisma.assignedWorkout.findFirst({
    where: {
      id: assignmentId,
      tenantId: member.tenantId,
      userId: member.id,
      origin: "MEMBER",
      memberStatus: "IN_REVIEW",
    },
    include: { template: { select: { name: true } } },
  });
  if (!assignment) redirect("/member/schema/builder");

  await prisma.assignedWorkout.update({
    where: { id: assignment.id },
    data: { memberStatus: statusAfterWithdraw(assignment.status), submittedAt: null },
  });
  await audit("schema.member.withdraw", {
    actor: { id: member.id, email: member.email, role: member.role },
    tenantId: member.tenantId,
    targetType: "AssignedWorkout",
    targetId: assignment.id,
    metadata: { name: assignment.template?.name ?? "schema" },
  });

  revalidatePath("/member/schema/builder");
  redirect(`/member/schema/builder/${assignment.id}`);
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
