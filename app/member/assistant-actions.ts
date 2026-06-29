"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { askGymAssistant, type AssistantContext } from "@/lib/ai";
import { machineTypeLabel } from "@/lib/machine";

const DAILY_LIMIT = 20;

export type AssistantResult = { answer?: string; error?: string };

const questionSchema = z.string().trim().min(1).max(500);

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function askAssistant(question: string): Promise<AssistantResult> {
  const member = await requireMember();

  const tenant = await prisma.tenant.findUnique({
    where: { id: member.tenantId },
    select: { name: true, aiEnabled: true },
  });
  if (!tenant?.aiEnabled) {
    return { error: "De AI-assistent staat uit voor deze sportschool." };
  }

  const parsed = questionSchema.safeParse(question);
  if (!parsed.success) {
    return { error: "Stel een vraag van 1–500 tekens." };
  }

  // Rate-limit: max 20 vragen per dag per lid.
  const usedToday = await prisma.aiUsage.count({
    where: { userId: member.id, createdAt: { gte: startOfToday() } },
  });
  if (usedToday >= DAILY_LIMIT) {
    return { error: `Daglimiet bereikt (${DAILY_LIMIT} vragen). Probeer het morgen weer.` };
  }

  // Context: alleen apparatuur/oefeningen van déze tenant + het schema van het lid.
  const [machines, exercises, assignment] = await Promise.all([
    prisma.machine.findMany({
      where: { tenantId: member.tenantId },
      select: { name: true, type: true },
    }),
    prisma.exercise.findMany({
      where: { tenantId: member.tenantId },
      select: { name: true },
    }),
    getAssignedSchema(member.id, member.tenantId),
  ]);

  const ctx: AssistantContext = {
    tenantName: tenant.name,
    machines: machines.map((m) => ({ name: m.name, type: machineTypeLabel(m.type) })),
    exercises: exercises.map((e) => e.name),
    schema: assignment?.template
      ? {
          name: assignment.template.name,
          items: assignment.template.items.map((it) => ({
            exercise: it.exercise.name,
            sets: it.sets,
            reps: it.reps,
          })),
        }
      : null,
  };

  const answer = await askGymAssistant(parsed.data, ctx);

  // Registreer het gebruik (na een succesvol antwoord).
  await prisma.aiUsage.create({
    data: { tenantId: member.tenantId, userId: member.id },
  });

  return { answer };
}
