"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMember, getAssignedSchema } from "@/lib/member";

/** Voeg de oefening(en) van een machine toe aan het schema van het lid. */
export async function addMachineToSchema(formData: FormData) {
  const member = await requireMember();
  const machineId = String(formData.get("machineId") ?? "");
  if (!machineId) redirect("/member/schema");

  const machine = await prisma.machine.findFirst({
    where: { id: machineId, tenantId: member.tenantId },
    include: { exercises: { select: { id: true } } },
  });
  if (!machine) redirect("/member/schema");

  const assignment = await getAssignedSchema(member.id, member.tenantId);
  if (!assignment?.template) redirect("/member/schema");

  const template = assignment.template;
  const existing = new Set(template.items.map((i) => i.exerciseId));
  const toAdd = machine.exercises.filter((e) => !existing.has(e.id));

  if (toAdd.length > 0) {
    let order = template.items.reduce((m, i) => Math.max(m, i.order), -1);
    await prisma.workoutExerciseItem.createMany({
      data: toAdd.map((e) => ({
        tenantId: member.tenantId,
        templateId: template.id,
        exerciseId: e.id,
        order: ++order,
        sets: 3,
        reps: 10,
        restSeconds: 60,
      })),
    });
  }

  revalidatePath("/member/schema");
  redirect("/member/schema");
}
