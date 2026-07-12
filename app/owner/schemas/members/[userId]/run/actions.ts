"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { resolveTrainedMember } from "@/lib/trainer-session";
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

// Trainer-varianten van de actieve-trainingsflow: een medewerker/PT draait een
// workout namens een lid. Elke action autoriseert via resolveTrainedMember
// (schemas:manage + lid van de eigen tenant) en scoopt op het lid; de trainer
// wordt vastgelegd als conductedById. Het `userId`-argument (het lid) wordt door
// de trainerpagina gebonden (.bind) — nooit uit client-input vertrouwd.

type Result = { ok: boolean };
type AlternativesResult = { ok: boolean; alternatives: AlternativeSuggestion[] };
type SubstituteResult = { ok: boolean; replacement?: SubstituteReplacement };

const memberPath = (userId: string) => `/owner/schemas/members/${userId}`;
const runPath = (userId: string) => `/owner/schemas/members/${userId}/run`;

/** Start (of hervat) een trainingssessie namens het lid en ga naar de run-pagina. */
export async function startTrainerSession(userId: string, formData: FormData) {
  const { trainer, member } = await resolveTrainedMember(userId);
  const requestedDayId = String(formData.get("dayId") ?? "");
  const sessionId = await startOrResumeSession(
    { tenantId: member.tenantId, userId: member.id },
    { requestedDayId, conductedById: trainer.id }
  );
  if (!sessionId) redirect(memberPath(userId));

  await audit("session.conduct.start", {
    actor: trainer,
    tenantId: trainer.tenantId,
    targetType: "User",
    targetId: member.id,
    metadata: { member: member.name ?? member.email },
  });
  redirect(runPath(userId));
}

export async function saveSetFor(userId: string, input: SetInput): Promise<Result> {
  const { member } = await resolveTrainedMember(userId);
  const ok = await upsertSet({ tenantId: member.tenantId, userId: member.id }, input);
  return { ok };
}

export async function saveLogFor(userId: string, input: LogInput): Promise<Result> {
  const { member } = await resolveTrainedMember(userId);
  const ok = await upsertLog({ tenantId: member.tenantId, userId: member.id }, input);
  return { ok };
}

export async function saveNoteFor(userId: string, input: NoteInput): Promise<Result> {
  const { member } = await resolveTrainedMember(userId);
  const ok = await upsertNote({ tenantId: member.tenantId, userId: member.id }, input);
  return { ok };
}

export async function skipFor(userId: string, input: SkipInput): Promise<Result> {
  const { member } = await resolveTrainedMember(userId);
  const ok = await setSkipped({ tenantId: member.tenantId, userId: member.id }, input, true);
  return { ok };
}

export async function unskipFor(userId: string, input: SkipInput): Promise<Result> {
  const { member } = await resolveTrainedMember(userId);
  const ok = await setSkipped({ tenantId: member.tenantId, userId: member.id }, input, false);
  return { ok };
}

const alternativesSchema = z.object({
  exerciseId: z.string().min(1),
  excludeIds: z.array(z.string()).default([]),
});

export async function getAlternativesFor(
  userId: string,
  input: z.infer<typeof alternativesSchema>
): Promise<AlternativesResult> {
  const { member } = await resolveTrainedMember(userId);
  const parsed = alternativesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, alternatives: [] };
  const alternatives = await alternativesFor(
    { tenantId: member.tenantId, userId: member.id },
    parsed.data.exerciseId,
    parsed.data.excludeIds
  );
  return { ok: true, alternatives };
}

export async function substituteFor(
  userId: string,
  input: SubstituteInput
): Promise<SubstituteResult> {
  const { member } = await resolveTrainedMember(userId);
  return substitute({ tenantId: member.tenantId, userId: member.id }, input);
}

const moodSchema = z.object({
  sessionId: z.string().min(1),
  mood: z.string().refine(isMood, "Onbekende mood"),
});

export async function saveMoodFor(
  userId: string,
  input: z.infer<typeof moodSchema>
): Promise<Result> {
  const { member } = await resolveTrainedMember(userId);
  const parsed = moodSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const ok = await setMood(
    { tenantId: member.tenantId, userId: member.id },
    parsed.data.sessionId,
    parsed.data.mood
  );
  return { ok };
}

/** Rond de sessie af namens het lid (trofeeën/stats tellen als het lid). */
export async function endSessionFor(userId: string, formData: FormData) {
  const { trainer, member } = await resolveTrainedMember(userId);
  const sessionId = String(formData.get("sessionId") ?? "");
  const ended = await finishSession(
    { tenantId: member.tenantId, userId: member.id },
    sessionId,
    { id: member.id, email: member.email }
  );
  if (ended) {
    await audit("session.conduct.complete", {
      actor: trainer,
      tenantId: trainer.tenantId,
      targetType: "User",
      targetId: member.id,
      metadata: { member: member.name ?? member.email },
    });
    // Het lid ziet z'n bijgewerkte historie/trofeeën bij het volgende bezoek.
    revalidatePath("/member");
    revalidatePath("/member/trophies");
    revalidatePath("/member/history");
  }
  redirect(memberPath(userId));
}

/** Annuleer de actieve sessie namens het lid (verwijdert 'm hard → telt niet mee). */
export async function cancelSessionFor(userId: string, formData: FormData) {
  const { trainer, member } = await resolveTrainedMember(userId);
  const sessionId = String(formData.get("sessionId") ?? "");
  await cancelSessionCore({ tenantId: member.tenantId, userId: member.id }, sessionId);
  await audit("session.conduct.cancel", {
    actor: trainer,
    tenantId: trainer.tenantId,
    targetType: "User",
    targetId: member.id,
    metadata: { member: member.name ?? member.email },
  });
  redirect(memberPath(userId));
}
