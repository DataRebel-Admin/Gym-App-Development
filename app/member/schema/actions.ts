"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { logParamsFromInputValues, logColumnsFromParams } from "@/lib/exercise-params";
import { evaluateAndAward } from "@/lib/achievements/evaluate";
import { isMood } from "@/lib/workout-moods";
import {
  recordMachineUsageForSession,
  evaluateDueMachines,
} from "@/lib/maintenance-eval";
import { notifyMaintenanceThresholds } from "@/lib/maintenance/notify";

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
export async function startSession() {
  const member = await requireMember();

  const assignment = await getAssignedSchema(member.id, member.tenantId);
  if (!assignment) redirect("/member/schema");

  const open = await prisma.workoutSession.findFirst({
    where: { tenantId: member.tenantId, userId: member.id, endedAt: null },
  });
  if (!open) {
    await prisma.workoutSession.create({
      data: { tenantId: member.tenantId, userId: member.id },
    });
  }
  redirect("/member/schema/active");
}

const setSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  setNumber: z.number().int().min(1).max(20),
  reps: z.number().int().min(0).max(100),
  weightKg: z.number().min(0).max(1000),
});

export type SaveSetResult = { ok: boolean };

/** Sla één set (reps + gewicht) op. Idempotent via upsert op de unieke set. */
export async function saveSet(
  input: z.infer<typeof setSchema>
): Promise<SaveSetResult> {
  const member = await requireMember();
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const data = parsed.data;

  // De sessie moet van dit lid zijn én nog open.
  const session = await prisma.workoutSession.findFirst({
    where: {
      id: data.sessionId,
      tenantId: member.tenantId,
      userId: member.id,
      endedAt: null,
    },
    select: { id: true },
  });
  if (!session) return { ok: false };

  // De oefening moet bij de tenant horen.
  const exercise = await prisma.exercise.findFirst({
    where: { id: data.exerciseId, tenantId: member.tenantId },
    select: { id: true },
  });
  if (!exercise) return { ok: false };

  await prisma.performanceEntry.upsert({
    where: {
      sessionId_exerciseId_setNumber: {
        sessionId: data.sessionId,
        exerciseId: data.exerciseId,
        setNumber: data.setNumber,
      },
    },
    create: {
      tenantId: member.tenantId,
      sessionId: data.sessionId,
      exerciseId: data.exerciseId,
      setNumber: data.setNumber,
      reps: data.reps,
      weightKg: data.weightKg,
    },
    update: { reps: data.reps, weightKg: data.weightKg },
  });

  return { ok: true };
}

const logSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  setNumber: z.number().int().min(1).max(50),
  values: z.record(z.string(), z.string()).default({}),
});

/**
 * Sla één type-bewust logresultaat op (cardio/isometrisch/…): de invoerwaarden
 * worden via de registry omgezet naar reps/weightKg-kolommen (kracht) + JSON-
 * params. Idempotent via upsert op (sessie, oefening, setNummer).
 */
export async function saveLog(
  input: z.infer<typeof logSchema>
): Promise<SaveSetResult> {
  const member = await requireMember();
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { sessionId, exerciseId, setNumber, values } = parsed.data;

  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, tenantId: member.tenantId, userId: member.id, endedAt: null },
    select: { id: true },
  });
  if (!session) return { ok: false };

  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, tenantId: member.tenantId },
    select: { exerciseType: true },
  });
  if (!exercise) return { ok: false };

  const params = logParamsFromInputValues(exercise.exerciseType, values);
  const cols = logColumnsFromParams(exercise.exerciseType, params);

  await prisma.performanceEntry.upsert({
    where: {
      sessionId_exerciseId_setNumber: { sessionId, exerciseId, setNumber },
    },
    create: {
      tenantId: member.tenantId,
      sessionId,
      exerciseId,
      setNumber,
      reps: cols.reps,
      weightKg: cols.weightKg,
      params: cols.params ?? undefined,
    },
    update: { reps: cols.reps, weightKg: cols.weightKg, params: cols.params ?? undefined },
  });

  return { ok: true };
}

const noteSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  notes: z.string().max(500),
});

/**
 * Sla een opmerking bij een oefening op. De notitie hangt aan de laagste
 * bestaande set-entry van de oefening in deze sessie; bestaat die nog niet, dan
 * komt er één lege entry (reps/gewicht 0). Zo blijft de notitie behouden los van
 * het afvinken van losse sets.
 */
export async function saveExerciseNote(
  input: z.infer<typeof noteSchema>
): Promise<SaveSetResult> {
  const member = await requireMember();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { sessionId, exerciseId, notes } = parsed.data;

  const session = await prisma.workoutSession.findFirst({
    where: {
      id: sessionId,
      tenantId: member.tenantId,
      userId: member.id,
      endedAt: null,
    },
    select: { id: true },
  });
  if (!session) return { ok: false };

  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, tenantId: member.tenantId },
    select: { id: true },
  });
  if (!exercise) return { ok: false };

  const existing = await prisma.performanceEntry.findFirst({
    where: { sessionId, exerciseId },
    orderBy: { setNumber: "asc" },
    select: { id: true },
  });

  if (existing) {
    await prisma.performanceEntry.update({
      where: { id: existing.id },
      data: { notes },
    });
  } else {
    await prisma.performanceEntry.create({
      data: {
        tenantId: member.tenantId,
        sessionId,
        exerciseId,
        setNumber: 1,
        reps: 0,
        weightKg: 0,
        notes,
      },
    });
  }

  return { ok: true };
}

const moodSchema = z.object({
  sessionId: z.string().min(1),
  mood: z.string().refine(isMood, "Onbekende mood"),
});

/**
 * Sla de trainingsbeleving (Workout Mood) op — one-tap na het afronden. Werkt op
 * een sessie van dit lid (open of net afgesloten). Idempotent: overschrijft de
 * vorige keuze. Lichtgewicht (geen redirect) — het afrondscherm roept dit
 * optimistisch aan.
 */
export async function saveWorkoutMood(
  input: z.infer<typeof moodSchema>
): Promise<SaveSetResult> {
  const member = await requireMember();
  const parsed = moodSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { sessionId, mood } = parsed.data;

  const res = await prisma.workoutSession.updateMany({
    where: { id: sessionId, tenantId: member.tenantId, userId: member.id },
    data: { mood },
  });
  return { ok: res.count > 0 };
}

/** Sluit de sessie af (zet endedAt) en ga naar de historie. */
export async function endSession(formData: FormData) {
  const member = await requireMember();
  const sessionId = String(formData.get("sessionId") ?? "");

  const res = await prisma.workoutSession.updateMany({
    where: {
      id: sessionId,
      tenantId: member.tenantId,
      userId: member.id,
      endedAt: null,
    },
    data: { endedAt: new Date() },
  });

  // Trofeeën evalueren zodra de training is afgerond (best-effort — breekt de
  // afronding nooit). De celebration-overlay toont het lid het resultaat.
  if (res.count > 0) {
    await evaluateAndAward(member.id, member.tenantId, { actor: { id: member.id, email: member.email } });
    revalidatePath("/member");
    revalidatePath("/member/trophies");

    // Machine-onderhoud: +1 gebruiksmoment per gebruikte machine, daarna direct
    // evalueren en de beheerders melden zodra een drempel bereikt is. Best-effort
    // — mag het afronden van de training nooit breken.
    try {
      const usedMachineIds = await recordMachineUsageForSession(sessionId, member.tenantId);
      if (usedMachineIds.length > 0) {
        const { due, soon } = await evaluateDueMachines(member.tenantId);
        await notifyMaintenanceThresholds({ tenantId: member.tenantId, dueIds: due, soonIds: soon });
      }
    } catch (err) {
      console.error("[maintenance] usage-hook mislukt:", (err as Error).message);
    }
  }

  revalidatePath("/member/history");
  redirect("/member/history");
}
