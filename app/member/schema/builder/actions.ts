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
import { applyCarriedPlan, capturePlanForCarryOver } from "@/lib/calendar";
import { resolveActiveLocationId } from "@/lib/location-resolve";
import { startOrResumeSession } from "@/lib/workout-session-ops";
import {
  requireMemberSchemaEnabled,
  memberSchemaModeFor,
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
import { MEMBER_LIBRARY_WHERE, MEMBER_DAY_LIBRARY_WHERE } from "@/lib/member-library-rules";
import { coverUrlForCopy, libraryTemplateImage } from "@/lib/schema-image";
import { libraryTemplateBadges } from "@/lib/schema-badges";
import { isTrainingGoal } from "@/lib/training-goals";
import {
  parseLibraryTemplateDays,
  parseTemplateReps,
  pickJsonName,
  trainingGoalFromLibrary,
} from "@/lib/exercise-library/mapping";
import {
  ensureLibraryExercises,
  countNewLibraryExercises,
} from "@/lib/library-exercise-sync";
import {
  getMemberDayTemplate,
  dayTemplateSlugs,
  dayTemplateItemGroup,
} from "@/lib/member-day-templates";
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

/** Eén te maken dag met ingevulde items (repdb-/dag-template-bron). */
type SpecDay = {
  name: string;
  items: {
    exerciseId: string;
    order: number;
    sets: number;
    reps: number;
    restSeconds: number;
    notes: string | null;
    // Groep-velden (superset/circuit/AMRAP) — alleen gevuld vanuit een
    // gecureerd dag-template; RepDB-bundeldagen kennen geen groepen.
    groupId?: string | null;
    groupType?: string | null;
    groupOrder?: number;
    groupRounds?: number | null;
    groupRestSeconds?: number | null;
    groupLabel?: string | null;
    groupTimeCapSeconds?: number | null;
  }[];
};

/** RepDB-bundel-dagen → SpecDay[] via de slug→Exercise-mapping (onbekende slugs vallen weg). */
function specsFromLibraryDays(
  days: ReturnType<typeof parseLibraryTemplateDays>,
  bySlug: Map<string, string>
): SpecDay[] {
  return days.map((d, i) => ({
    name: d.name_en?.trim() || `Dag ${i + 1}`,
    items: (d.exercises ?? []).flatMap((e, order) => {
      const exerciseId = bySlug.get(e.exercise_id);
      if (!exerciseId) return [];
      const parsed = parseTemplateReps(e.reps ?? "");
      const notes = [parsed.note, e.notes_en?.trim() || null].filter(Boolean).join(" · ");
      return [
        {
          exerciseId,
          order,
          sets: e.sets ?? 3,
          reps: parsed.reps ?? 10,
          restSeconds: e.rest_seconds ?? 60,
          notes: notes || null,
        },
      ];
    }),
  }));
}

/** Dag-template uit de registry → SpecDay (zelfde reps-parsing als de import). */
function specFromDayTemplate(
  def: NonNullable<ReturnType<typeof getMemberDayTemplate>>,
  bySlug: Map<string, string>
): SpecDay {
  // Teller per groep: `groupOrder` is de plek bínnen de groep (A1, B1, B2, ...).
  const groupSeen = new Map<string, number>();
  return {
    name: def.name,
    items: def.items.flatMap((e, order) => {
      const exerciseId = bySlug.get(e.slug);
      if (!exerciseId) return [];
      const parsed = parseTemplateReps(e.reps);
      const notes = [parsed.note, e.notes ?? null].filter(Boolean).join(" · ");
      // Groep pas meeschrijven als het dag-template er een definieert; de
      // clamp is dezelfde die de owner-editor gebruikt.
      const group = dayTemplateItemGroup(def, e);
      const groupOrder = group && e.group ? (groupSeen.get(e.group) ?? 0) : 0;
      if (group && e.group) groupSeen.set(e.group, groupOrder + 1);
      const columns = normalizeGroupColumns(
        group && e.group
          ? {
              groupId: `${def.key}-${e.group}`,
              groupType: group.type,
              groupOrder,
              groupRounds: group.rounds ?? null,
              groupRestSeconds: group.restSeconds ?? null,
              groupLabel: group.label ?? null,
              groupTimeCapSeconds: group.timeCapSeconds ?? null,
            }
          : {}
      );
      return [
        {
          exerciseId,
          order,
          sets: e.sets,
          reps: parsed.reps ?? 10,
          restSeconds: e.restSeconds,
          notes: notes || null,
          groupId: columns.groupId,
          groupType: columns.groupType,
          groupOrder: columns.groupOrder,
          groupRounds: columns.groupRounds,
          groupRestSeconds: columns.groupRestSeconds,
          groupLabel: columns.groupLabel,
          groupTimeCapSeconds: columns.groupTimeCapSeconds,
        },
      ];
    }),
  };
}

/**
 * Start een nieuw zelf-gebouwd schema: leeg, vanuit een blueprint, vanuit een
 * door de owner vrijgegeven library-template (schema of dag), rechtstreeks
 * vanuit een RepDB-voorbeeldschema of vanuit een gecureerd dag-template
 * (template-catalogus). Maakt een niet-library WorkoutTemplate (concept) +
 * AssignedWorkout(origin=MEMBER, DRAFT) en gaat naar de editor.
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
  const spec = await resolveStartSource(member.tenantId, source);

  const created = await prisma.$transaction(async (tx) => {
    const templateId = await createTemplateFromSpec(tx, member.tenantId, spec);
    const assignment = await tx.assignedWorkout.create({
      data: {
        tenantId: member.tenantId,
        userId: member.id,
        templateId,
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
    metadata: {
      name: spec.name,
      source: source.split(":")[0],
      ...(spec.newExercises > 0 ? { newExercises: spec.newExercises } : {}),
    },
  });

  redirect(`/member/schema/builder/${created.id}`);
}

/**
 * Eenmalige workout uit de catalogus: dezelfde bron als "Gebruik dit schema",
 * maar de kopie krijgt géén toewijzing — het actieve schema blijft wat het is.
 * De sessie start meteen op de gekozen dag (`day` = index in de bron; een
 * dag-template heeft er één). Een al lopende training wordt gewoon hervat.
 * Annuleren ruimt de kopie weer op (lib/workout-session-ops.ts `cancelSession`).
 */
export async function startOneOffWorkout(formData: FormData) {
  const member = await requireMember();
  await requireMemberSchemaEnabled(member.tenantId);

  const source = String(formData.get("source") ?? "");
  const dayIndex = Math.max(0, Number.parseInt(String(formData.get("day") ?? "0"), 10) || 0);
  if (!source || source.startsWith("blueprint:") || source === "scratch") {
    redirect("/member/schema/templates");
  }

  // Loopt er al een training? Dan geen tweede kopie aanmaken — hervatten.
  const open = await prisma.workoutSession.findFirst({
    where: { tenantId: member.tenantId, userId: member.id, endedAt: null },
    select: { id: true },
  });
  if (open) redirect("/member/schema/active");

  const spec = await resolveStartSource(member.tenantId, source);
  const templateId = await prisma.$transaction((tx) =>
    createTemplateFromSpec(tx, member.tenantId, spec)
  );
  const days = await prisma.workoutDay.findMany({
    where: { tenantId: member.tenantId, templateId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const dayId = days[dayIndex]?.id ?? days[0]?.id ?? null;

  const me = await prisma.user.findFirst({
    where: { id: member.id, tenantId: member.tenantId },
    select: { homeLocationId: true },
  });
  const locationId = await resolveActiveLocationId(member.tenantId, {
    homeLocationId: me?.homeLocationId,
  });
  const sessionId = await startOrResumeSession(
    { tenantId: member.tenantId, userId: member.id },
    { locationId, requestedDayId: dayId, templateId }
  );
  if (!sessionId) redirect("/member/schema/templates");

  await audit("session.oneoff.start", {
    actor: { id: member.id, email: member.email, role: member.role },
    tenantId: member.tenantId,
    targetType: "WorkoutSession",
    targetId: sessionId,
    metadata: {
      name: spec.name,
      source: source.split(":")[0],
      ...(spec.newExercises > 0 ? { newExercises: spec.newExercises } : {}),
    },
  });
  // Zie startSession (app/member/schema/actions.ts): balk + blijvende melding
  // hangen aan de member-layout.
  revalidatePath("/member", "layout");
  redirect("/member/schema/active");
}

/** Alles wat nodig is om uit een startbron een nieuw WorkoutTemplate te bouwen. */
type StartSpec = {
  name: string;
  description: string | null;
  imageUrl: string | null;
  templateGoal: string | null;
  badges: string[];
  newExercises: number;
  /** Lege dagen (blueprint/scratch). */
  dayNames: string[];
  /** Ingevulde dagen (RepDB-/dag-template-bron). */
  daySpecs: SpecDay[] | null;
  /** Te klonen tenant-template (vrijgegeven gym-schema of -dag). */
  clonedFrom: Prisma.WorkoutTemplateGetPayload<{
    include: { days: { include: { items: true } } };
  }> | null;
};

/**
 * Vertaal een startbron (`template:`/`tenantday:`/`repdb:`/`day:`/`blueprint:`/
 * scratch) naar een `StartSpec`. Gedeeld door "zelf een schema beginnen" en
 * "eenmalig doen" zodat beide dezelfde autoritatieve hercontrole van de bron
 * doen (nooit de client vertrouwen). Onbekende bron → terug naar de catalogus.
 */
async function resolveStartSource(tenantId: string, source: string): Promise<StartSpec> {
  // Bepaal naam + dag-structuur op basis van de bron.
  let name = "Mijn schema";
  let dayNames: string[] = ["Dag 1"];
  let description: string | null = null;
  let imageUrl: string | null = null;
  let templateGoal: string | null = null;
  let badges: string[] = [];
  let newExercises = 0;
  let daySpecs: SpecDay[] | null = null;
  let clonedFrom: StartSpec["clonedFrom"] = null;

  if (source.startsWith("template:") || source.startsWith("tenantday:")) {
    const isDay = source.startsWith("tenantday:");
    const templateId = source.slice(source.indexOf(":") + 1);
    clonedFrom = await prisma.workoutTemplate.findFirst({
      // Autoritatieve hercontrole van de bron: dezelfde where als het
      // library-overzicht (nooit de client vertrouwen). Zie
      // lib/member-library-rules.ts voor waarom dit één constante is.
      where: {
        id: templateId,
        tenantId,
        ...(isDay ? MEMBER_DAY_LIBRARY_WHERE : MEMBER_LIBRARY_WHERE),
      },
      include: { days: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } } },
    });
    if (!clonedFrom) redirect(isDay ? "/member/schema/templates" : "/member/schema/builder/new");
    name = isDay ? clonedFrom.name : `${clonedFrom.name} (mijn versie)`;
    description = clonedFrom.description;
    // Neem het beeld van het sjabloon over, zodat "mijn versie" er in de lijst
    // hetzelfde uitziet als het schema waar het lid mee begon.
    imageUrl = coverUrlForCopy(clonedFrom);
  } else if (source.startsWith("repdb:")) {
    // Rechtstreeks een RepDB-voorbeeldschema overnemen (template-catalogus).
    // Ontbrekende oefeningen worden eerst als tenant-Exercise aangemaakt —
    // zelfde pad als de owner-import (lib/library-exercise-sync.ts).
    const tpl = await prisma.libraryWorkoutTemplate.findFirst({
      where: { id: source.slice("repdb:".length), retiredAt: null },
    });
    if (!tpl) redirect("/member/schema/templates");
    const days = parseLibraryTemplateDays(tpl.days);
    const slugs = days.flatMap((d) => (d.exercises ?? []).map((e) => e.exercise_id));
    newExercises = await countNewLibraryExercises(tenantId, slugs);
    const bySlug = await ensureLibraryExercises(tenantId, slugs);
    name = pickJsonName(tpl.names, ["nl", "en"]) ?? tpl.id;
    description = pickJsonName(tpl.descriptions, ["nl", "en"]);
    // Herkomst-foto hard meeschrijven; bewust nooit `libraryTemplateId` op de
    // kopie (dat is de idempotentie-sleutel van de owner-import).
    imageUrl = libraryTemplateImage(tpl.id, tpl.goal)?.url ?? null;
    templateGoal = trainingGoalFromLibrary(tpl.goal);
    badges = libraryTemplateBadges(tpl);
    daySpecs = specsFromLibraryDays(days, bySlug);
  } else if (source.startsWith("day:")) {
    // Gecureerd dag-template (lib/member-day-templates.ts) als los schema.
    const def = getMemberDayTemplate(source.slice("day:".length));
    if (!def) redirect("/member/schema/templates");
    const slugs = dayTemplateSlugs(def);
    newExercises = await countNewLibraryExercises(tenantId, slugs);
    const bySlug = await ensureLibraryExercises(tenantId, slugs);
    name = def.name;
    description = def.description;
    imageUrl = libraryTemplateImage(def.photoSlug, def.goals[0] ?? null)?.url ?? null;
    templateGoal = isTrainingGoal(def.goals[0]) ? def.goals[0] : null;
    badges = def.badges;
    daySpecs = [specFromDayTemplate(def, bySlug)];
  } else if (source.startsWith("blueprint:")) {
    const bp = getBlueprint(source.slice("blueprint:".length));
    if (bp && bp.key !== "scratch") {
      name = bp.label;
      dayNames = bp.days;
    }
  }

  return { name, description, imageUrl, templateGoal, badges, newExercises, dayNames, daySpecs, clonedFrom };
}

/**
 * Maak een niet-library WorkoutTemplate (+ dagen + oefeningen) uit een
 * `StartSpec`. Hangt bewust nog nergens aan: de aanroeper koppelt er een
 * AssignedWorkout (eigen schema) of een WorkoutSession (eenmalig) aan.
 */
async function createTemplateFromSpec(
  tx: Prisma.TransactionClient,
  tenantId: string,
  spec: StartSpec
): Promise<string> {
  const { name, description, imageUrl, templateGoal, badges, dayNames, daySpecs, clonedFrom } =
    spec;
  const tpl = await tx.workoutTemplate.create({
      data: {
        tenantId,
        name,
        description,
        imageUrl,
        goal: templateGoal,
        badges,
        isLibrary: false,
      },
    });

    if (clonedFrom) {
      for (const d of clonedFrom.days) {
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
    } else if (daySpecs) {
      for (const [i, d] of daySpecs.entries()) {
        await tx.workoutDay.create({
          data: {
            tenantId,
            templateId: tpl.id,
            order: i,
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
                notes: it.notes,
                groupId: it.groupId ?? null,
                groupType: it.groupType ?? null,
                groupOrder: it.groupOrder ?? 0,
                groupRounds: it.groupRounds ?? null,
                groupRestSeconds: it.groupRestSeconds ?? null,
                groupLabel: it.groupLabel ?? null,
                groupTimeCapSeconds: it.groupTimeCapSeconds ?? null,
              })),
            },
          },
        });
      }
    } else {
      await Promise.all(
        dayNames.map((dn, i) =>
          tx.workoutDay.create({
            data: { tenantId, templateId: tpl.id, order: i, name: dn },
          })
        )
      );
    }

  return tpl.id;
}

/**
 * Voeg een dag-template (gecureerd of vrijgegeven door de gym) als extra dag
 * toe aan een bestaand, bewerkbaar eigen schema. Zelfde poorten als de builder
 * (`assertEditAllowed` dekt zelf-gebouwd én — bij `memberCanEditAssigned` —
 * een toegewezen schema). Een dag-maximum bestaat niet: dagen toevoegen mag
 * altijd (besluit eigenaar 2026-09-09).
 */
export async function addDayFromTemplate(formData: FormData) {
  const member = await requireMember();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const ref = String(formData.get("ref") ?? "");

  const assignment = await loadOwnAssignment(assignmentId, member.id, member.tenantId);
  if (!assignment?.template) redirect("/member/schema/templates");
  const blocked = await assertEditAllowed(member.tenantId, assignment);
  if (blocked) redirect("/member/schema/builder");

  // Bron: gecureerd dag-template of vrijgegeven gym-dag-template.
  let dayName: string;
  let items: Prisma.WorkoutExerciseItemUncheckedCreateWithoutDayInput[] = [];
  const templateId = assignment.template.id;
  const base = { tenantId: member.tenantId, templateId };

  if (ref.startsWith("day:")) {
    const key = ref.slice("day:".length);
    const def = getMemberDayTemplate(key);
    if (!def) redirect("/member/schema/templates");
    const bySlug = await ensureLibraryExercises(member.tenantId, dayTemplateSlugs(def));
    const spec = specFromDayTemplate(def, bySlug);
    dayName = spec.name;
    items = spec.items.map((it) => ({ ...base, ...it }));
  } else if (ref.startsWith("tenantday:")) {
    const id = ref.slice("tenantday:".length);
    const source = await prisma.workoutTemplate.findFirst({
      where: { id, tenantId: member.tenantId, ...MEMBER_DAY_LIBRARY_WHERE },
      include: { days: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } } },
    });
    const day = source?.days[0];
    if (!source || !day) redirect("/member/schema/templates");
    dayName = day.name;
    items = day.items.map((it) => ({
      ...base,
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
    }));
  } else {
    redirect("/member/schema/templates");
  }

  const dayCount = await prisma.workoutDay.count({ where: { templateId } });

  await prisma.workoutDay.create({
    data: {
      tenantId: member.tenantId,
      templateId,
      order: dayCount,
      name: dayName,
      items: { create: items },
    },
  });

  revalidatePath(`/member/schema/builder/${assignment.id}`);
  redirect(`/member/schema/builder/${assignment.id}`);
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
    const mode = await memberSchemaModeFor(tenantId);
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
    data: { memberStatus: "PAUSED", status: "ARCHIVED", archivedAt: new Date() },
  });
  // Actief coach-schema → gearchiveerd.
  await tx.assignedWorkout.updateMany({
    where: { tenantId, userId, origin: "COACH", status: "PUBLISHED", id: { not: exceptId } },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
}

/** Zet een zelf-schema live (zichtbaar in de trainingsomgeving). */
async function activate(
  tenantId: string,
  userId: string,
  assignmentId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Weekdagplanning van het vorige actieve schema meenemen (lib/calendar.ts).
    const carried = await capturePlanForCarryOver(tx, tenantId, userId, assignmentId);
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
    await applyCarriedPlan(tx, { tenantId, assignmentId, carried });
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
    data: { memberStatus: "PAUSED", status: "ARCHIVED", archivedAt: new Date() },
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
