"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { isMood } from "@/lib/workout-moods";
import type { AlternativeSuggestion } from "@/lib/exercise-alternatives";
import {
  startOrResumeSession,
  upsertSet,
  upsertLog,
  upsertNote,
  setSkipped,
  alternativesFor,
  substitute,
  setMood,
  finishSession,
  cancelSession as cancelSessionCore,
  type SetInput,
  type LogInput,
  type NoteInput,
  type SkipInput,
  type SubstituteInput,
  type SubstituteReplacement,
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
  const sessionId = await startOrResumeSession(
    { tenantId: member.tenantId, userId: member.id },
    { requestedDayId }
  );
  if (!sessionId) redirect("/member/schema");
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

/** Annuleer de actieve workout: verwijder de sessie volledig (entries cascaden mee). */
export async function cancelSession(formData: FormData) {
  const member = await requireMember();
  const sessionId = String(formData.get("sessionId") ?? "");
  await cancelSessionCore({ tenantId: member.tenantId, userId: member.id }, sessionId);
  revalidatePath("/member");
  revalidatePath("/member/schema");
  redirect("/member/schema");
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
