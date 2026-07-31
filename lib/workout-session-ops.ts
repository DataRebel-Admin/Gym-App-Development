import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
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
  withoutSub,
  withSetCount,
  MAX_SESSION_SETS,
} from "@/lib/session-overrides";
import { findAlternatives, type AlternativeSuggestion } from "@/lib/exercise-alternatives";
import { exerciseThumbUrl, EXERCISE_THUMB_SELECT } from "@/lib/exercise-thumb";

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
 * `locationId` = de vestiging waar getraind wordt (resolutie door de aanroeper,
 * zie lib/location-resolve.ts); alleen relevant bij het aanmaken — een hervatte
 * sessie behoudt zijn oorspronkelijke vestiging.
 * Retourneert de sessie-id, of `null` als het lid geen actief schema heeft.
 */
export async function startOrResumeSession(
  ctx: SessionSubject,
  opts: { locationId: string; requestedDayId?: string | null; conductedById?: string | null }
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
      locationId: opts.locationId,
      dayId,
      conductedById: opts.conductedById ?? null,
    },
  });
  return created.id;
}

/**
 * Getalveld dat een geldige invoer nooit stil laat afketsen: niet-getallen
 * worden 0 en waarden buiten bereik worden geklémd i.p.v. geweigerd. Reden: een
 * afgewezen veld (bv. 12,5 herhalingen uit de stepper) leverde het lid midden in
 * z'n set een "niet opgeslagen"-fout op die met dezelfde waarde bleef falen.
 */
function clampedNumber(max: number, opts: { int?: boolean } = {}) {
  return z.preprocess((value) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return 0;
    const bounded = Math.min(max, Math.max(0, n));
    return opts.int ? Math.round(bounded) : Math.round(bounded * 100) / 100;
  }, z.number());
}

export const setInputSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  setNumber: z.number().int().min(1).max(MAX_SESSION_SETS),
  reps: clampedNumber(100, { int: true }),
  weightKg: clampedNumber(1000),
});
export type SetInput = z.infer<typeof setInputSchema>;

/**
 * Schrijf één log-regel weg (idempotent op de unieke set). Vangt de race af
 * waarbij twee snel opeenvolgende saves van dezelfde set elkaar kruisen: de
 * upsert ziet dan nog geen rij, terwijl de insert alsnog op de unique-index
 * (sessionId, exerciseId, setNumber) botst (P2002). De rij bestáát op dat
 * moment, dus we werken 'm alsnog bij i.p.v. het lid een "niet opgeslagen" te
 * tonen voor een set die gewoon opgeslagen kan worden.
 */
async function writePerformanceEntry(
  tenantId: string,
  key: { sessionId: string; exerciseId: string; setNumber: number },
  data: { reps: number; weightKg: number; params?: Prisma.InputJsonValue }
): Promise<void> {
  try {
    await prisma.performanceEntry.upsert({
      where: { sessionId_exerciseId_setNumber: key },
      create: { tenantId, ...key, ...data },
      update: data,
    });
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;
    await prisma.performanceEntry.update({
      where: { sessionId_exerciseId_setNumber: key },
      data,
    });
  }
}

/** Sla één kracht-set (reps + gewicht) op. Idempotent via upsert op de unieke set. */
export async function upsertSet(ctx: SessionSubject, input: SetInput): Promise<boolean> {
  const parsed = setInputSchema.safeParse(input);
  if (!parsed.success) {
    console.warn("[workout] set geweigerd (validatie):", parsed.error.issues);
    return false;
  }
  const data = parsed.data;

  const session = await loadOpenSession(ctx, data.sessionId);
  if (!session) {
    console.warn("[workout] set geweigerd: geen open sessie", data.sessionId);
    return false;
  }

  const exercise = await prisma.exercise.findFirst({
    where: { id: data.exerciseId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!exercise) {
    console.warn("[workout] set geweigerd: onbekende oefening", data.exerciseId);
    return false;
  }

  await writePerformanceEntry(
    ctx.tenantId,
    { sessionId: data.sessionId, exerciseId: data.exerciseId, setNumber: data.setNumber },
    { reps: data.reps, weightKg: data.weightKg }
  );
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

  await writePerformanceEntry(
    ctx.tenantId,
    { sessionId, exerciseId, setNumber },
    {
      reps: cols.reps,
      weightKg: cols.weightKg,
      ...(cols.params ? { params: cols.params as Prisma.InputJsonValue } : {}),
    }
  );
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

export const setCountInputSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  count: z.number().int().min(1).max(MAX_SESSION_SETS),
});
export type SetCountInput = z.infer<typeof setCountInputSchema>;

/**
 * Leg het aantal sets van één oefening in déze sessie vast (het lid heeft een
 * set toegevoegd of verwijderd). Sessie-scoped: het schema blijft ongewijzigd.
 * Zonder deze registratie verdween een toegevoegde, nog lege set zodra de
 * pagina opnieuw laadde — er staat immers nog geen log-regel tegenover.
 */
export async function setSessionSetCount(
  ctx: SessionSubject,
  input: SetCountInput
): Promise<boolean> {
  const parsed = setCountInputSchema.safeParse(input);
  if (!parsed.success) return false;
  const { sessionId, exerciseId, count } = parsed.data;

  const session = await loadOpenSession(ctx, sessionId);
  if (!session) return false;

  await prisma.workoutSession.update({
    where: { id: session.id },
    data: { overrides: toOverridesJson(withSetCount(session.overrides, exerciseId, count)) },
  });
  return true;
}

export const removeSetInputSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  setNumber: z.number().int().min(2).max(MAX_SESSION_SETS),
});
export type RemoveSetInput = z.infer<typeof removeSetInputSchema>;

/**
 * Verwijder de láátste set van een oefening in deze sessie: de bijbehorende
 * log-regel gaat weg (anders zou de set bij het herladen terugkomen én in het
 * volume blijven meetellen) en het nieuwe set-aantal wordt vastgelegd. Alleen
 * de laatste set is verwijderbaar (setNumber ≥ 2), zodat de nummering van
 * opgeslagen sets nooit verschuift.
 */
export async function removeSessionSet(
  ctx: SessionSubject,
  input: RemoveSetInput
): Promise<boolean> {
  const parsed = removeSetInputSchema.safeParse(input);
  if (!parsed.success) return false;
  const { sessionId, exerciseId, setNumber } = parsed.data;

  const session = await loadOpenSession(ctx, sessionId);
  if (!session) return false;

  await prisma.performanceEntry.deleteMany({
    where: { tenantId: ctx.tenantId, sessionId, exerciseId, setNumber: { gte: setNumber } },
  });
  await prisma.workoutSession.update({
    where: { id: session.id },
    data: {
      overrides: toOverridesJson(withSetCount(session.overrides, exerciseId, setNumber - 1)),
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
      // Bron-bewust beeld (bibliotheek → klassiek → eigen).
      ...EXERCISE_THUMB_SELECT,
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
      thumbUrl: exerciseThumbUrl(replacement),
    },
  };
}

export const revertSubstituteInputSchema = z.object({
  sessionId: z.string().min(1),
  /** Exercise.id van het oorspronkelijke template-item (de sleutel van de sub). */
  exerciseId: z.string().min(1),
});
export type RevertSubstituteInput = z.infer<typeof revertSubstituteInputSchema>;
export type RevertedExercise = SubstituteReplacement & {
  /** Al gelogde sets van de oorspronkelijke oefening in déze sessie. */
  entries: { setNumber: number; reps: number; weightKg: number; params: unknown }[];
  /** Sessie-scoped set-aantal van het origineel (null = schema-aantal). */
  sessionSets: number | null;
};

/**
 * Draai een gekozen alternatief terug naar de oorspronkelijke oefening. De op
 * het alternatief gelogde sets blijven staan (dat werk is echt gedaan en telt
 * gewoon mee in de historie); alleen de weergave gaat terug. Retourneert de
 * identiteit + reeds gelogde sets van het origineel, zodat de actieve sessie de
 * kaart in-place kan herstellen zonder herladen.
 */
export async function revertSubstitution(
  ctx: SessionSubject,
  input: RevertSubstituteInput
): Promise<{ ok: boolean; original?: RevertedExercise }> {
  const parsed = revertSubstituteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { sessionId, exerciseId } = parsed.data;

  const session = await loadOpenSession(ctx, sessionId);
  if (!session) return { ok: false };

  const original = await prisma.exercise.findFirst({
    where: { id: exerciseId, tenantId: ctx.tenantId },
    select: {
      id: true,
      name: true,
      machine: { select: { name: true } },
      ...EXERCISE_THUMB_SELECT,
    },
  });
  if (!original) return { ok: false };

  const next = withoutSub(session.overrides, exerciseId);
  await prisma.workoutSession.update({
    where: { id: session.id },
    data: { overrides: toOverridesJson(next) },
  });

  const entries = await prisma.performanceEntry.findMany({
    where: { sessionId, exerciseId },
    select: { setNumber: true, reps: true, weightKg: true, params: true },
    orderBy: { setNumber: "asc" },
  });

  return {
    ok: true,
    original: {
      exerciseId: original.id,
      name: original.name,
      machineName: original.machine?.name ?? null,
      thumbUrl: exerciseThumbUrl(original),
      entries,
      sessionSets: next.setCounts[exerciseId] ?? null,
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
