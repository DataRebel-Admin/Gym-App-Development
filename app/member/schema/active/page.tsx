import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { getWorkoutContext } from "@/lib/member-stats";
import { targetSummaryFromItem } from "@/lib/exercise-params";
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
      params: true,
      notes: true,
    },
  });

  const template = assignment.template;

  // "Vorige keer": de sets van de meest recente eerder afgeronde sessie waarin
  // het lid deze oefening deed (per oefening apart — kan uit verschillende
  // sessies komen). Placeholder-entries (reps 0 én 0 kg) negeren.
  const prevRows = await prisma.performanceEntry.findMany({
    where: {
      tenantId: member.tenantId,
      sessionId: { not: open.id },
      session: { userId: member.id, endedAt: { not: null } },
    },
    select: {
      exerciseId: true,
      setNumber: true,
      reps: true,
      weightKg: true,
      session: { select: { id: true, startedAt: true } },
    },
    orderBy: [{ session: { startedAt: "desc" } }, { setNumber: "asc" }],
  });

  type PrevSet = { setNumber: number; reps: number; weightKg: number };
  const prevByExercise = new Map<string, { date: Date; sets: PrevSet[] }>();
  const chosenSession = new Map<string, string>();
  for (const r of prevRows) {
    if (r.reps === 0 && r.weightKg === 0) continue; // notitie-placeholder
    const chosen = chosenSession.get(r.exerciseId);
    if (chosen === undefined) {
      chosenSession.set(r.exerciseId, r.session.id);
      prevByExercise.set(r.exerciseId, { date: r.session.startedAt, sets: [] });
    } else if (chosen !== r.session.id) {
      continue; // alleen de meest recente sessie per oefening
    }
    prevByExercise.get(r.exerciseId)!.sets.push({
      setNumber: r.setNumber,
      reps: r.reps,
      weightKg: r.weightKg,
    });
  }

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
    const prev = prevByExercise.get(item.exerciseId);
    return {
      exerciseId: item.exerciseId,
      exerciseType: item.exercise.exerciseType,
      name: item.exercise.name,
      machineName: item.exercise.machine?.name ?? null,
      thumbUrl:
        item.exercise.catalog?.imageUrl ?? item.exercise.catalog?.gifUrl ?? null,
      dayName,
      sets: item.sets,
      targetReps: item.reps,
      targetWeightKg: item.weightKg ?? null,
      tempo: item.tempo ?? null,
      targetSummary: targetSummaryFromItem(item, item.exercise.exerciseType),
      restSeconds: item.restSeconds,
      note: savedNote ?? item.notes ?? null,
      entries: own.map((e) => ({
        setNumber: e.setNumber,
        reps: e.reps,
        weightKg: e.weightKg,
        params: e.params,
      })),
      previous: prev
        ? {
            date: prev.date.toISOString(),
            sets: prev.sets.sort((a, b) => a.setNumber - b.setNumber),
          }
        : null,
    };
  });

  const context = await getWorkoutContext(open.id, member.id, member.tenantId);

  return (
    <ActiveSession
      sessionId={open.id}
      startedAt={open.startedAt.toISOString()}
      exercises={exercises}
      context={context}
    />
  );
}
