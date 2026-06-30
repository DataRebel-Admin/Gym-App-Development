import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { ActiveSession, type ActiveExercise } from "./active-session";

export const metadata = { title: "Actieve training" };

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
    select: {
      exerciseId: true,
      setNumber: true,
      reps: true,
      weightKg: true,
      notes: true,
    },
  });

  const template = assignment.template;

  // Bouw één geordende lijst, gegroepeerd op trainingsdag wanneer die er zijn.
  // (Na de dag-backfill zitten alle items in een dag; oudere schema's vallen
  // terug op de platte items-lijst.)
  type Item = (typeof template.items)[number];
  const ordered: { item: Item; dayName: string | null }[] =
    template.days.length > 0
      ? template.days.flatMap((d) =>
          d.items.map((item) => ({
            item,
            dayName: template.days.length > 1 ? d.name : null,
          }))
        )
      : template.items.map((item) => ({ item, dayName: null }));

  const exercises: ActiveExercise[] = ordered.map(({ item, dayName }) => {
    const own = entries.filter((e) => e.exerciseId === item.exerciseId);
    // Bestaande opmerking: eerst een eerder opgeslagen set-notitie, anders de
    // streef-notitie die de trainer bij de oefening zette.
    const savedNote = own.find((e) => e.notes && e.notes.trim().length > 0)?.notes;
    return {
      exerciseId: item.exerciseId,
      name: item.exercise.name,
      machineName: item.exercise.machine?.name ?? null,
      thumbUrl:
        item.exercise.catalog?.imageUrl ?? item.exercise.catalog?.gifUrl ?? null,
      dayName,
      sets: item.sets,
      targetReps: item.reps,
      targetWeightKg: item.weightKg ?? null,
      restSeconds: item.restSeconds,
      note: savedNote ?? item.notes ?? null,
      entries: own.map((e) => ({
        setNumber: e.setNumber,
        reps: e.reps,
        weightKg: e.weightKg,
      })),
    };
  });

  return (
    <ActiveSession
      sessionId={open.id}
      startedAt={open.startedAt.toISOString()}
      exercises={exercises}
    />
  );
}
