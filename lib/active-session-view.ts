import "server-only";
import { prisma } from "@/lib/db";
import { getAssignedSchema } from "@/lib/member";
import { getWorkoutContext } from "@/lib/member-stats";
import { targetSummaryFromItem } from "@/lib/exercise-params";
import { getHideQuotes, getDisableSetTimers } from "@/lib/user-preferences";
import { parseOverrides } from "@/lib/session-overrides";
import { resolveQuotes, pickQuote } from "@/lib/workout-quotes";
import { pickRecoveryTip } from "@/lib/recovery-tips";
import type {
  ActiveExercise,
  WorkoutContextProps,
  RewardProps,
} from "@/app/member/schema/active/active-session";

export type ActiveSessionView = {
  startedAt: string;
  exercises: ActiveExercise[];
  context: WorkoutContextProps;
  reward: RewardProps;
  timersDefaultOn: boolean;
};

/**
 * Bouw alle presentatie-props voor `ActiveSession` uit het toegewezen schema + de
 * open sessie van één lid. Bewust auth-loos en subject-geparametriseerd zodat
 * zowel de lid-pagina (`/member/schema/active`) als de trainer-pagina
 * (`/owner/schemas/members/[userId]/run`) dezelfde weergave delen — de aanroeper
 * dwingt de autorisatie af. Retourneert `null` als de open sessie of het schema
 * ontbreekt (caller redirect dan weg).
 */
export async function buildActiveSessionView(
  tenantId: string,
  memberId: string,
  sessionId: string
): Promise<ActiveSessionView | null> {
  const open = await prisma.workoutSession.findFirst({
    where: { id: sessionId, tenantId, userId: memberId, endedAt: null },
  });
  if (!open) return null;

  const assignment = await getAssignedSchema(memberId, tenantId);
  if (!assignment?.template) return null;

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

  // Sessie-scoped aanpassingen (overslaan + vervangen) — muteren het template niet.
  const overrides = parseOverrides(open.overrides);
  const skippedIds = new Set(overrides.skipped);
  const subByOriginal = new Map(overrides.subs.map((s) => [s.from, s]));
  const subTargets =
    overrides.subs.length > 0
      ? await prisma.exercise.findMany({
          where: { tenantId, id: { in: overrides.subs.map((s) => s.to) } },
          select: {
            id: true,
            name: true,
            machine: { select: { name: true } },
            catalog: { select: { imageUrl: true, gifUrl: true } },
          },
        })
      : [];
  const subTargetById = new Map(subTargets.map((e) => [e.id, e]));

  // "Vorige keer": sets van de meest recente eerder afgeronde sessie per oefening.
  const relevantExerciseIds = [
    ...new Set<string>([
      ...template.items.map((i) => i.exerciseId),
      ...template.days.flatMap((d) => d.items.map((i) => i.exerciseId)),
      ...overrides.subs.map((s) => s.to),
    ]),
  ];
  const prevRows = await prisma.performanceEntry.findMany({
    where: {
      tenantId,
      sessionId: { not: open.id },
      exerciseId: { in: relevantExerciseIds },
      session: { userId: memberId, endedAt: { not: null } },
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

  // Gekozen trainingsdag (je doet één dag per sessie). Alleen honoreren als de dag
  // nog in het schema bestaat.
  const selectedDayId =
    open.dayId && template.days.some((d) => d.id === open.dayId) ? open.dayId : null;

  type Item = (typeof template.items)[number];
  const ordered: { item: Item; dayName: string | null }[] =
    template.days.length > 0
      ? template.days
          .filter((d) => !selectedDayId || d.id === selectedDayId)
          .flatMap((d) =>
            d.items.map((item) => ({
              item,
              dayName: selectedDayId || template.days.length > 1 ? d.name : null,
            }))
          )
      : template.items.map((item) => ({ item, dayName: null }));

  const exercises: ActiveExercise[] = ordered.map(({ item, dayName }) => {
    const originalId = item.exerciseId;
    const sub = subByOriginal.get(originalId);
    const subTarget = sub ? subTargetById.get(sub.to) : undefined;
    const renderedId = subTarget ? subTarget.id : originalId;

    const own = entries.filter((e) => e.exerciseId === renderedId);
    const savedNote = own.find((e) => e.notes && e.notes.trim().length > 0)?.notes;
    const prev = prevByExercise.get(renderedId);
    return {
      exerciseId: renderedId,
      originalExerciseId: originalId,
      exerciseType: item.exercise.exerciseType,
      name: subTarget ? subTarget.name : item.exercise.name,
      machineName: subTarget
        ? subTarget.machine?.name ?? null
        : item.exercise.machine?.name ?? null,
      thumbUrl: subTarget
        ? subTarget.catalog?.imageUrl ?? subTarget.catalog?.gifUrl ?? null
        : item.exercise.catalog?.imageUrl ?? item.exercise.catalog?.gifUrl ?? null,
      substitutedFrom: subTarget ? item.exercise.name : null,
      skipped: skippedIds.has(originalId),
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

  const context = await getWorkoutContext(open.id, memberId, tenantId);

  const [tenant, userRow] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { quotesEnabled: true, customQuotes: true },
    }),
    prisma.user.findUnique({
      where: { id: memberId },
      select: { preferences: true },
    }),
  ]);
  const quotesOn = (tenant?.quotesEnabled ?? true) && !getHideQuotes(userRow?.preferences);
  const reward: RewardProps = {
    initialMood: open.mood ?? null,
    recoveryTip: pickRecoveryTip(open.id),
    quote: quotesOn ? pickQuote(resolveQuotes(tenant?.customQuotes), open.id) : null,
  };

  const timersDefaultOn = !getDisableSetTimers(userRow?.preferences);

  return {
    startedAt: open.startedAt.toISOString(),
    exercises,
    context,
    reward,
    timersDefaultOn,
  };
}
