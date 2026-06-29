import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { ActiveSession, type ActiveExercise } from "./active-session";

export default async function ActiveSessionPage() {
  const member = await requireMember();

  const open = await prisma.workoutSession.findFirst({
    where: { tenantId: member.tenantId, userId: member.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!open) redirect("/member/schema");

  const assignment = await getAssignedSchema(member.id, member.tenantId);
  if (!assignment?.template) redirect("/member/schema");

  const entries = await prisma.performanceEntry.findMany({
    where: { sessionId: open.id },
    select: { exerciseId: true, setNumber: true, reps: true, weightKg: true },
  });

  const exercises: ActiveExercise[] = assignment.template.items.map((it) => ({
    exerciseId: it.exerciseId,
    name: it.exercise.name,
    machineName: it.exercise.machine?.name ?? null,
    sets: it.sets,
    targetReps: it.reps,
    entries: entries
      .filter((e) => e.exerciseId === it.exerciseId)
      .map((e) => ({ setNumber: e.setNumber, reps: e.reps, weightKg: e.weightKg })),
  }));

  return <ActiveSession sessionId={open.id} exercises={exercises} />;
}
