"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";

/** Start (of hervat) een trainingssessie en ga naar de actieve-sessie-pagina. */
export async function startSession() {
  const member = await requireMember();

  const assignment = await prisma.assignedWorkout.findFirst({
    where: { tenantId: member.tenantId, userId: member.id },
  });
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

/** Sluit de sessie af (zet endedAt) en ga naar de historie. */
export async function endSession(formData: FormData) {
  const member = await requireMember();
  const sessionId = String(formData.get("sessionId") ?? "");

  await prisma.workoutSession.updateMany({
    where: {
      id: sessionId,
      tenantId: member.tenantId,
      userId: member.id,
      endedAt: null,
    },
    data: { endedAt: new Date() },
  });

  revalidatePath("/member/history");
  redirect("/member/history");
}
