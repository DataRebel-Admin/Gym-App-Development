"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { resolveActiveLocationId } from "@/lib/location-resolve";
import { audit } from "@/lib/audit";
import { applyCarriedPlan, capturePlanForCarryOver } from "@/lib/calendar";
import { canMakeActive, isTrainableSchema } from "@/lib/schema-switch";
import { isMood } from "@/lib/workout-moods";
import type { AlternativeSuggestion } from "@/lib/exercise-alternatives";
import {
  startOrResumeSession,
  upsertSet,
  upsertLog,
  upsertNote,
  setSkipped,
  setSessionSetCount,
  removeSessionSet,
  alternativesFor,
  substitute,
  revertSubstitution as revertSubstitutionCore,
  setMood,
  finishSession,
  cancelSession as cancelSessionCore,
  type SetInput,
  type LogInput,
  type NoteInput,
  type SkipInput,
  type SetCountInput,
  type RemoveSetInput,
  type SubstituteInput,
  type SubstituteReplacement,
  type RevertSubstituteInput,
  type RevertedExercise,
} from "@/lib/workout-session-ops";

// De actieve-trainingslogica leeft in lib/workout-session-ops.ts (subject-
// geparametriseerd, gedeeld met de trainer-flow). Deze actions zijn de dunne
// lid-wrappers: autoriseren via requireMember (subject = het ingelogde lid zelf,
// geen conductedById) en verzorgen revalidatie/redirect.

export type SaveSetResult = { ok: boolean };
export type AlternativesResult = { ok: boolean; alternatives: AlternativeSuggestion[] };
export type SubstituteResult = { ok: boolean; replacement?: SubstituteReplacement };

/**
 * Markeer het actieve schema als gezien (verwijdert de "Nieuw"-indicator).
 * Idempotent: zet `seenAt` alleen als die nog leeg is. Faalt nooit hard.
 */
export async function markActiveSchemaSeen(): Promise<void> {
  try {
    const member = await requireMember();
    const now = new Date();
    await prisma.assignedWorkout.updateMany({
      where: {
        tenantId: member.tenantId,
        userId: member.id,
        status: "PUBLISHED",
        seenAt: null,
        OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
      },
      data: { seenAt: now },
    });
    revalidatePath("/member");
    revalidatePath("/member/schema");
  } catch {
    // stil falen — de indicator is cosmetisch
  }
}

/** Start (of hervat) een trainingssessie en ga naar de actieve-sessie-pagina. */
export async function startSession(formData?: FormData) {
  const member = await requireMember();
  const requestedDayId = formData ? String(formData.get("dayId") ?? "") : "";
  // Vestiging: device-cookie (switcher) → thuisvestiging → default (D8).
  const locationId = await sessionLocationFor(member);
  const sessionId = await startOrResumeSession(
    { tenantId: member.tenantId, userId: member.id },
    { locationId, requestedDayId }
  );
  if (!sessionId) redirect("/member/schema");
  // De "training bezig"-balk én de blijvende native melding hangen aan
  // `getRunningSessionStart` in de member-**layout**. Een layout rendert niet
  // opnieuw bij navigatie binnen datzelfde segment, en `revalidatePath(path)`
  // raakt alleen de pagina. Zonder de expliciete "layout"-variant bleef de
  // layout dus de stand van vóór het starten vasthouden: geen balk, geen
  // melding, tot er toevallig een volledige herrender langskwam (dat is de
  // "hij komt een paar minuten later vanzelf"-klacht).
  revalidatePath("/member", "layout");
  redirect("/member/schema/active");
}

/** Sla één kracht-set (reps + gewicht) op. Idempotent via upsert op de unieke set. */
export async function saveSet(input: SetInput): Promise<SaveSetResult> {
  const member = await requireMember();
  const ok = await upsertSet({ tenantId: member.tenantId, userId: member.id }, input);
  return { ok };
}

/** Sla één type-bewust logresultaat op (cardio/isometrisch/…). */
export async function saveLog(input: LogInput): Promise<SaveSetResult> {
  const member = await requireMember();
  const ok = await upsertLog({ tenantId: member.tenantId, userId: member.id }, input);
  return { ok };
}

/** Sla een opmerking bij een oefening op. */
export async function saveExerciseNote(input: NoteInput): Promise<SaveSetResult> {
  const member = await requireMember();
  const ok = await upsertNote({ tenantId: member.tenantId, userId: member.id }, input);
  return { ok };
}

const moodSchema = z.object({
  sessionId: z.string().min(1),
  mood: z.string().refine(isMood, "Onbekende mood"),
});

/** Sla de trainingsbeleving (Workout Mood) op — one-tap na het afronden. */
export async function saveWorkoutMood(
  input: z.infer<typeof moodSchema>
): Promise<SaveSetResult> {
  const member = await requireMember();
  const parsed = moodSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const ok = await setMood(
    { tenantId: member.tenantId, userId: member.id },
    parsed.data.sessionId,
    parsed.data.mood
  );
  return { ok };
}

/** Sluit de sessie af (zet endedAt) en ga naar de historie. */
export async function endSession(formData: FormData) {
  const member = await requireMember();
  const sessionId = String(formData.get("sessionId") ?? "");

  const ended = await finishSession(
    { tenantId: member.tenantId, userId: member.id },
    sessionId,
    { id: member.id, email: member.email ?? null }
  );
  if (ended) {
    revalidatePath("/member");
    revalidatePath("/member/trophies");
  }
  revalidatePath("/member/history");
  // Spiegelt startSession: de layout moet de balk en de blijvende melding
  // meteen opruimen, niet pas bij een toevallige volledige herrender.
  revalidatePath("/member", "layout");
  redirect("/member/history");
}

/** Markeer een oefening als overgeslagen in déze sessie (sessie-scoped). */
export async function skipExercise(input: SkipInput): Promise<SaveSetResult> {
  const member = await requireMember();
  const ok = await setSkipped({ tenantId: member.tenantId, userId: member.id }, input, true);
  return { ok };
}

/** Maak een skip ongedaan (oefening weer actief in deze sessie). */
export async function unskipExercise(input: SkipInput): Promise<SaveSetResult> {
  const member = await requireMember();
  const ok = await setSkipped({ tenantId: member.tenantId, userId: member.id }, input, false);
  return { ok };
}

/** Leg het aantal sets van een oefening in deze sessie vast (set toegevoegd). */
export async function setSetCount(input: SetCountInput): Promise<SaveSetResult> {
  const member = await requireMember();
  const ok = await setSessionSetCount({ tenantId: member.tenantId, userId: member.id }, input);
  return { ok };
}

/** Verwijder de laatste set van een oefening (incl. een evt. gelogd resultaat). */
export async function removeSet(input: RemoveSetInput): Promise<SaveSetResult> {
  const member = await requireMember();
  const ok = await removeSessionSet({ tenantId: member.tenantId, userId: member.id }, input);
  return { ok };
}

const alternativesSchema = z.object({
  exerciseId: z.string().min(1),
  excludeIds: z.array(z.string()).default([]),
});

/** Haal alternatieve oefeningen op (zelfde spiergroep/type/lichaamsdeel). */
export async function getExerciseAlternatives(
  input: z.infer<typeof alternativesSchema>
): Promise<AlternativesResult> {
  const member = await requireMember();
  const parsed = alternativesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, alternatives: [] };
  const alternatives = await alternativesFor(
    { tenantId: member.tenantId, userId: member.id },
    parsed.data.exerciseId,
    parsed.data.excludeIds
  );
  return { ok: true, alternatives };
}

/** Vervang een oefening door een alternatief voor déze sessie (template blijft ongewijzigd). */
export async function substituteExercise(input: SubstituteInput): Promise<SubstituteResult> {
  const member = await requireMember();
  return substitute({ tenantId: member.tenantId, userId: member.id }, input);
}

/** Zet een gekozen alternatief terug naar de oorspronkelijke oefening. */
export async function revertSubstitution(
  input: RevertSubstituteInput
): Promise<{ ok: boolean; original?: RevertedExercise }> {
  const member = await requireMember();
  return revertSubstitutionCore({ tenantId: member.tenantId, userId: member.id }, input);
}

/** Annuleer de actieve workout: verwijder de sessie volledig (entries cascaden mee). */
export async function cancelSession(formData: FormData) {
  const member = await requireMember();
  const sessionId = String(formData.get("sessionId") ?? "");
  await cancelSessionCore({ tenantId: member.tenantId, userId: member.id }, sessionId);
  revalidatePath("/member");
  revalidatePath("/member/schema");
  // Zie startSession: zonder de layout-variant blijven balk en melding staan
  // terwijl de sessie al weg is.
  revalidatePath("/member", "layout");
  redirect("/member/schema");
}

/** Vestiging voor een nieuwe sessie: device-cookie (switcher) → thuisvestiging → default. */
async function sessionLocationFor(member: { id: string; tenantId: string }): Promise<string> {
  const me = await prisma.user.findFirst({
    where: { id: member.id, tenantId: member.tenantId },
    select: { homeLocationId: true },
  });
  return resolveActiveLocationId(member.tenantId, { homeLocationId: me?.homeLocationId });
}

/**
 * Wissel van actief schema: het gekozen schema wordt actief, wat nu actief is
 * wordt gepauzeerd (eigen) of gearchiveerd (coach) — zonder iets weg te gooien,
 * dus terugwisselen kan altijd. Een lopende training merkt er niets van: die
 * hangt aan haar eigen `WorkoutSession.templateId`. Weekdagplanning blijft per
 * schema bewaard; een schema zónder planning erft die van het vorige (zelfde
 * capture/apply-paar als elk ander archiveer-en-vervang-pad, lib/calendar.ts).
 */
export async function switchActiveSchema(formData: FormData) {
  const member = await requireMember();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const now = new Date();

  const target = await prisma.assignedWorkout.findFirst({
    where: { id: assignmentId, tenantId: member.tenantId, userId: member.id },
    select: {
      id: true,
      origin: true,
      status: true,
      memberStatus: true,
      availableFrom: true,
      endDate: true,
      publishedAt: true,
      template: { select: { name: true } },
    },
  });
  if (!target || !canMakeActive({ ...target, hasTemplate: target.template !== null }, now)) {
    redirect("/member/schema/wisselen?err=1");
  }
  const current = await getAssignedSchema(member.id, member.tenantId);
  if (current?.id === target.id) redirect("/member/schema");

  await prisma.$transaction(async (tx) => {
    const carried = await capturePlanForCarryOver(tx, member.tenantId, member.id, target.id);
    // Wat nu live staat opzij zetten. Een eigen schema wordt gepauzeerd (zoals
    // `pauseMemberSchema`); een schema in beoordeling houdt z'n memberStatus,
    // anders zou de coach een verdwenen indiening beoordelen.
    const priors = await tx.assignedWorkout.findMany({
      where: { tenantId: member.tenantId, userId: member.id, status: "PUBLISHED", id: { not: target.id } },
      select: { id: true, origin: true, memberStatus: true },
    });
    for (const p of priors) {
      await tx.assignedWorkout.update({
        where: { id: p.id },
        data: {
          status: "ARCHIVED",
          archivedAt: now,
          ...(p.origin === "MEMBER" && p.memberStatus === "ACTIVE" ? { memberStatus: "PAUSED" } : {}),
        },
      });
    }
    // Het doel live zetten. De oorspronkelijke publicatiedatum blijft de nullijn
    // voor voortgang en geldigheid (zelfde keuze als `activate()` in de builder).
    await tx.assignedWorkout.update({
      where: { id: target.id },
      data: {
        status: "PUBLISHED",
        publishedAt: target.publishedAt ?? now,
        availableFrom: null,
        archivedAt: null,
        ...(target.origin === "MEMBER" ? { memberStatus: "ACTIVE", seenAt: now } : {}),
      },
    });
    await applyCarriedPlan(tx, { tenantId: member.tenantId, assignmentId: target.id, carried });
  });

  await audit("schema.switch", {
    actor: { id: member.id, email: member.email, role: member.role },
    tenantId: member.tenantId,
    targetType: "AssignedWorkout",
    targetId: target.id,
    metadata: {
      name: target.template?.name ?? "schema",
      origin: target.origin,
      previous: current?.template?.name ?? null,
    },
  });

  revalidatePath("/member");
  revalidatePath("/member/schema");
  revalidatePath("/member/schema/wisselen");
  revalidatePath("/member/schema/builder");
  revalidatePath("/member/agenda");
  redirect("/member/schema?switched=1");
}

/**
 * Eenmalig trainen op een ander schema van het lid (gepauzeerd, goedgekeurd of
 * een eerder trainer-schema) zonder het actieve schema te wijzigen. De sessie
 * krijgt `templateId` + `oneOff`; een lopende training wordt gewoon hervat.
 */
export async function startOneOffFromAssignment(formData: FormData) {
  const member = await requireMember();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const requestedDayId = String(formData.get("dayId") ?? "");

  const target = await prisma.assignedWorkout.findFirst({
    where: { id: assignmentId, tenantId: member.tenantId, userId: member.id },
    select: {
      id: true,
      origin: true,
      status: true,
      memberStatus: true,
      availableFrom: true,
      endDate: true,
      templateId: true,
      template: { select: { name: true } },
    },
  });
  if (
    !target?.templateId ||
    !isTrainableSchema({ ...target, hasTemplate: true }, new Date())
  ) {
    redirect("/member/schema/wisselen?err=1");
  }

  const locationId = await sessionLocationFor(member);
  const sessionId = await startOrResumeSession(
    { tenantId: member.tenantId, userId: member.id },
    { locationId, requestedDayId, templateId: target.templateId }
  );
  if (!sessionId) redirect("/member/schema/wisselen?err=1");

  await audit("session.oneoff.start", {
    actor: { id: member.id, email: member.email, role: member.role },
    tenantId: member.tenantId,
    targetType: "WorkoutSession",
    targetId: sessionId,
    metadata: { name: target.template?.name ?? "schema", source: "assignment" },
  });
  // Zie startSession: de balk en de blijvende melding hangen aan de layout.
  revalidatePath("/member", "layout");
  redirect("/member/schema/active");
}

/**
 * Markeer de eenmalige "automatisch gestopt na 5 uur"-melding als gezien.
 * Idempotent + best-effort (de melding is cosmetisch).
 */
export async function markAutoStopSeen(): Promise<void> {
  try {
    const member = await requireMember();
    await prisma.workoutSession.updateMany({
      where: {
        tenantId: member.tenantId,
        userId: member.id,
        autoStoppedAt: { not: null },
        autoStopNotified: false,
      },
      data: { autoStopNotified: true },
    });
    revalidatePath("/member/schema");
  } catch {
    // stil falen — de melding is cosmetisch
  }
}
