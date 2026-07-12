import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAssignedSchema } from "@/lib/member";
import { logParamsFromInputValues, logColumnsFromParams } from "@/lib/exercise-params";
import { evaluateAndAward } from "@/lib/achievements/evaluate";
import { recordMachineUsageForSession, evaluateDueMachines } from "@/lib/maintenance-eval";
import { notifyMaintenanceThresholds } from "@/lib/maintenance/notify";
import { isFeatureEnabled } from "@/lib/features/service";
import {
  toOverridesJson,
  withSkipped,
  withoutSkipped,
  withSub,
} from "@/lib/session-overrides";
import { findAlternatives, type AlternativeSuggestion } from "@/lib/exercise-alternatives";

/**
 * Auth-loze kern van de actieve-trainingsflow, geparametriseerd op het *subject*
 * (het lid) en de tenant. Zowel de lid-actions (`app/member/schema/actions.ts`,
 * subject = ingelogd lid) als de trainer-actions
 * (`app/owner/schemas/members/[userId]/run/actions.ts`, subject = het gecoachte
 * lid) delen deze logica. Elke functie scoopt strikt op `(tenantId, userId)` —
 * de aanroeper dwingt de autorisatie af (`requireMember` / `resolveTrainedMember`)
 * en zorgt voor revalidatie/redirect/audit. Zo blijft er één bron van waarheid
 * voor het loggen, overslaan, vervangen, afronden en annuleren.
 */
export type SessionSubject = { tenantId: string; userId: string };

/** Laad de open (nog niet afgeronde) sessie van het subject. */
async function loadOpenSession(ctx: SessionSubject, sessionId: string) {
  return prisma.workoutSession.findFirst({
    where: { id: sessionId, tenantId: ctx.tenantId, userId: ctx.userId, endedAt: null },
    select: { id: true, overrides: true },
  });
}

/**
 * Start (of hervat) een trainingssessie voor het subject. Bij een schema met
 * meerdere dagen wordt de gekozen `requestedDayId` alleen gehonoreerd als die dag
 * echt bij het toegewezen schema hoort. Is er al een open sessie, dan hervatten we
 * die (één workout tegelijk). `conductedById` markeert een trainer-gedraaide
 * sessie; bij hervatten wordt een nog-lege conductor best-effort alsnog gezet.
 * Retourneert de sessie-id, of `null` als het lid geen actief schema heeft.
 */
export async function startOrResumeSession(
  ctx: SessionSubject,
  opts: { requestedDayId?: string | null; conductedById?: string | null } = {}
): Promise<string | null> {
  const assignment = await getAssignedSchema(ctx.userId, ctx.tenantId);
  if (!assignment) return null;

  const open = await prisma.workoutSession.findFirst({
    where: { tenantId: ctx.tenantId, userId: ctx.userId, endedAt: null },
    select: { id: true, conductedById: true },
  });
  if (open) {
    if (opts.conductedById && !open.conductedById) {
      await prisma.workoutSession.update({
        where: { id: open.id },
        data: { conductedById: opts.conductedById },
      });
    }
    return open.id;
  }

  // Optionele dagkeuze: alleen accepteren als de dag echt bij dit schema hoort.
  let dayId: string | null = null;
  if (opts.requestedDayId && assignment.template) {
    const day = await prisma.workoutDay.findFirst({
      where: {
        id: opts.requestedDayId,
        tenantId: ctx.tenantId,
        templateId: assignment.template.id,
      },
      select: { id: true },
    });
    dayId = day?.id ?? null;
  }

  const created = await prisma.workoutSession.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      dayId,
      conductedById: opts.conductedById ?? null,
    },
  });
  return created.id;
}

export const setInputSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  setNumber: z.number().int().min(1).max(20),
  reps: z.number().int().min(0).max(100),
  weightKg: z.number().min(0).max(1000),
});
export type SetInput = z.infer<typeof setInputSchema>;

/** Sla één kracht-set (reps + gewicht) op. Idempotent via upsert op de unieke set. */
export async function upsertSet(ctx: SessionSubject, input: SetInput): Promise<boolean> {
  const parsed = setInputSchema.safeParse(input);
  if (!parsed.success) return false;
  const data = parsed.data;

  const session = await loadOpenSession(ctx, data.sessionId);
  if (!session) return false;

  const exercise = await prisma.exercise.findFirst({
    where: { id: data.exerciseId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!exercise) return false;

  await prisma.performanceEntry.upsert({
    where: {
      sessionId_exerciseId_setNumber: {
        sessionId: data.sessionId,
        exerciseId: data.exerciseId,
        setNumber: data.setNumber,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      sessionId: data.sessionId,
      exerciseId: data.exerciseId,
      setNumber: data.setNumber,
      reps: data.reps,
      weightKg: data.weightKg,
    },
    update: { reps: data.reps, weightKg: data.weightKg },
  });
  return true;
}

export const logInputSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  setNumber: z.number().int().min(1).max(50),
  values: z.record(z.string(), z.string()).default({}),
});
export type LogInput = z.infer<typeof logInputSchema>;

/** Sla één type-bewust logresultaat op (cardio/isometrisch/…) via de registry. */
export async function upsertLog(ctx: SessionSubject, input: LogInput): Promise<boolean> {
  const parsed = logInputSchema.safeParse(input);
  if (!parsed.success) return false;
  const { sessionId, exerciseId, setNumber, values } = parsed.data;

  const session = await loadOpenSession(ctx, sessionId);
  if (!session) return false;

  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, tenantId: ctx.tenantId },
    select: { exerciseType: true },
  });
  if (!exercise) return false;

  const params = logParamsFromInputValues(exercise.exerciseType, values);
  const cols = logColumnsFromParams(exercise.exerciseType, params);

  await prisma.performanceEntry.upsert({
    where: { sessionId_exerciseId_setNumber: { sessionId, exerciseId, setNumber } },
    create: {
      tenantId: ctx.tenantId,
      sessionId,
      exerciseId,
      setNumber,
      reps: cols.reps,
      weightKg: cols.weightKg,
      params: cols.params ?? undefined,
    },
    update: { reps: cols.reps, weightKg: cols.weightKg, params: cols.params ?? undefined },
  });
  return true;
}

export const noteInputSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  notes: z.string().max(500),
});
export type NoteInput = z.infer<typeof noteInputSchema>;

/** Sla een opmerking bij een oefening op (aan de laagste bestaande set-entry). */
export async function upsertNote(ctx: SessionSubject, input: NoteInput): Promise<boolean> {
  const parsed = noteInputSchema.safeParse(input);
  if (!parsed.success) return false;
  const { sessionId, exerciseId, notes } = parsed.data;

  const session = await loadOpenSession(ctx, sessionId);
  if (!session) return false;

  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!exercise) return false;

  const existing = await prisma.performanceEntry.findFirst({
    where: { sessionId, exerciseId },
    orderBy: { setNumber: "asc" },
    select: { id: true },
  });

  if (existing) {
    await prisma.performanceEntry.update({ where: { id: existing.id }, data: { notes } });
  } else {
    await prisma.performanceEntry.create({
      data: { tenantId: ctx.tenantId, sessionId, exerciseId, setNumber: 1, reps: 0, weightKg: 0, notes },
    });
  }
  return true;
}

export const skipInputSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
});
export type SkipInput = z.infer<typeof skipInputSchema>;

/** Markeer (of ontmarkeer) een oefening als overgeslagen in deze sessie. */
export async function setSkipped(
  ctx: SessionSubject,
  input: SkipInput,
  skip: boolean
): Promise<boolean> {
  const parsed = skipInputSchema.safeParse(input);
  if (!parsed.success) return false;
  const { sessionId, exerciseId } = parsed.data;

  const session = await loadOpenSession(ctx, sessionId);
  if (!session) return false;

  await prisma.workoutSession.update({
    where: { id: session.id },
    data: {
      overrides: toOverridesJson(
        skip ? withSkipped(session.overrides, exerciseId) : withoutSkipped(session.overrides, exerciseId)
      ),
    },
  });
  return true;
}

/** Haal alternatieve oefeningen op (zelfde spiergroep/type/lichaamsdeel). */
export async function alternativesFor(
  ctx: SessionSubject,
  exerciseId: string,
  excludeIds: string[]
): Promise<AlternativeSuggestion[]> {
  return findAlternatives(ctx.tenantId, exerciseId, excludeIds);
}

export const substituteInputSchema = z.object({
  sessionId: z.string().min(1),
  fromExerciseId: z.string().min(1),
  toExerciseId: z.string().min(1),
});
export type SubstituteInput = z.infer<typeof substituteInputSchema>;
export type SubstituteReplacement = {
  exerciseId: string;
  name: string;
  machineName: string | null;
  thumbUrl: string | null;
};

/** Vervang een oefening door een alternatief voor deze sessie (template blijft ongewijzigd). */
export async function substitute(
  ctx: SessionSubject,
  input: SubstituteInput
): Promise<{ ok: boolean; replacement?: SubstituteReplacement }> {
  const parsed = substituteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { sessionId, fromExerciseId, toExerciseId } = parsed.data;
  if (fromExerciseId === toExerciseId) return { ok: false };

  const session = await loadOpenSession(ctx, sessionId);
  if (!session) return { ok: false };

  const replacement = await prisma.exercise.findFirst({
    where: { id: toExerciseId, tenantId: ctx.tenantId, archivedAt: null },
    select: {
      id: true,
      name: true,
      machine: { select: { name: true } },
      catalog: { select: { imageUrl: true, gifUrl: true } },
    },
  });
  if (!replacement) return { ok: false };

  await prisma.workoutSession.update({
    where: { id: session.id },
    data: {
      overrides: toOverridesJson(
        withSub(session.overrides, { from: fromExerciseId, to: toExerciseId, name: replacement.name })
      ),
    },
  });

  return {
    ok: true,
    replacement: {
      exerciseId: replacement.id,
      name: replacement.name,
      machineName: replacement.machine?.name ?? null,
      thumbUrl: replacement.catalog?.imageUrl ?? replacement.catalog?.gifUrl ?? null,
    },
  };
}

/** Sla de trainingsbeleving (Workout Mood) op. Werkt op een open of net afgesloten sessie. */
export async function setMood(
  ctx: SessionSubject,
  sessionId: string,
  mood: string
): Promise<boolean> {
  const res = await prisma.workoutSession.updateMany({
    where: { id: sessionId, tenantId: ctx.tenantId, userId: ctx.userId },
    data: { mood },
  });
  return res.count > 0;
}

/**
 * Rond de sessie af (zet `endedAt`) en draai de vervolg-hooks: trofeeën toekennen
 * aan het **subject-lid** en het machine-onderhoud bijwerken. Best-effort: de
 * hooks mogen het afronden nooit breken. Retourneert of er daadwerkelijk een open
 * sessie is afgerond (idempotent).
 */
export async function finishSession(
  ctx: SessionSubject,
  sessionId: string,
  awardActor: { id: string; email: string | null }
): Promise<boolean> {
  const res = await prisma.workoutSession.updateMany({
    where: { id: sessionId, tenantId: ctx.tenantId, userId: ctx.userId, endedAt: null },
    data: { endedAt: new Date() },
  });
  if (res.count === 0) return false;

  // Trofeeën horen bij het lid (subject), ongeacht wie de sessie draaide.
  await evaluateAndAward(ctx.userId, ctx.tenantId, {
    actor: { id: awardActor.id, email: awardActor.email },
  });

  // Machine-onderhoud: +1 gebruiksmoment per gebruikte machine + evalueren/melden.
  try {
    if (await isFeatureEnabled(ctx.tenantId, "maintenance")) {
      const usedMachineIds = await recordMachineUsageForSession(sessionId, ctx.tenantId);
      if (usedMachineIds.length > 0) {
        const { due, soon } = await evaluateDueMachines(ctx.tenantId);
        await notifyMaintenanceThresholds({ tenantId: ctx.tenantId, dueIds: due, soonIds: soon });
      }
    }
  } catch (err) {
    console.error("[maintenance] usage-hook mislukt:", (err as Error).message);
  }
  return true;
}

/** Annuleer de actieve sessie: verwijder 'm hard (entries cascaden) → telt niet mee. */
export async function cancelSession(ctx: SessionSubject, sessionId: string): Promise<void> {
  await prisma.workoutSession.deleteMany({
    where: { id: sessionId, tenantId: ctx.tenantId, userId: ctx.userId, endedAt: null },
  });
}
