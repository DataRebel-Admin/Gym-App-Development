import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { getWorkoutContext } from "@/lib/member-stats";
import { targetSummaryFromItem } from "@/lib/exercise-params";
import { getHideQuotes, getDisableSetTimers } from "@/lib/user-preferences";
import { enforceSessionTimeout } from "@/lib/session-timeout";
import { parseOverrides } from "@/lib/session-overrides";
import { resolveQuotes, pickQuote } from "@/lib/workout-quotes";
import { pickRecoveryTip } from "@/lib/recovery-tips";
import { ActiveSession, type ActiveExercise } from "./active-session";

export const metadata = { title: "Actieve training" };

export default async function ActiveSessionPage() {
  const member = await requireMember();

  // Automatische 5-uur-timeout: sluit een te lang openstaande sessie eerst af.
  // Daarna is er geen open sessie meer → terug naar het schema (met melding).
  const timeout = await enforceSessionTimeout(member.tenantId, member.id);
  // Geen (nog-open) sessie of net auto-gestopt → terug naar het schema. Voorkomt een
  // tweede open-sessie-query wanneer er toch niets te hervatten is.
  if (timeout.autoStopped || !timeout.sessionId) redirect("/member/schema");

  // De volledige rij is nodig (overrides/dayId); haal 'm gericht op via de reeds
  // door enforceSessionTimeout bepaalde id.
  const open = await prisma.workoutSession.findFirst({
    where: { id: timeout.sessionId, tenantId: member.tenantId, userId: member.id, endedAt: null },
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

  // Sessie-scoped aanpassingen (overslaan + vervangen) — muteren het template
  // niet. Laad de identiteit van de gekozen alternatieven zodat we ze in plaats
  // van het origineel kunnen tonen (het set/rep-schema van het origineel blijft).
  const overrides = parseOverrides(open.overrides);
  const skippedIds = new Set(overrides.skipped);
  const subByOriginal = new Map(overrides.subs.map((s) => [s.from, s]));
  const subTargets =
    overrides.subs.length > 0
      ? await prisma.exercise.findMany({
          where: { tenantId: member.tenantId, id: { in: overrides.subs.map((s) => s.to) } },
          select: {
            id: true,
            name: true,
            machine: { select: { name: true } },
            catalog: { select: { imageUrl: true, gifUrl: true } },
          },
        })
      : [];
  const subTargetById = new Map(subTargets.map((e) => [e.id, e]));

  // "Vorige keer": de sets van de meest recente eerder afgeronde sessie waarin
  // het lid deze oefening deed (per oefening apart — kan uit verschillende
  // sessies komen). Placeholder-entries (reps 0 én 0 kg) negeren.
  //
  // Begrens de scan tot de oefeningen die vandaag getoond worden (schema-oefeningen
  // + gekozen alternatieven) i.p.v. de volledige prestatiehistorie van álle
  // oefeningen te lezen. prevByExercise wordt hieronder alleen per gerenderde
  // oefening uitgelezen, dus de output is identiek.
  const relevantExerciseIds = [
    ...new Set<string>([
      ...template.items.map((i) => i.exerciseId),
      ...template.days.flatMap((d) => d.items.map((i) => i.exerciseId)),
      ...overrides.subs.map((s) => s.to),
    ]),
  ];
  const prevRows = await prisma.performanceEntry.findMany({
    where: {
      tenantId: member.tenantId,
      sessionId: { not: open.id },
      exerciseId: { in: relevantExerciseIds },
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

  // Gekozen trainingsdag (je doet één dag per sessie). Alleen honoreren als de dag
  // nog in het schema bestaat — anders vallen we terug op het hele schema zodat de
  // sessie nooit leeg is als een dag intussen is verwijderd.
  const selectedDayId =
    open.dayId && template.days.some((d) => d.id === open.dayId) ? open.dayId : null;

  // Bouw één geordende lijst, gegroepeerd op trainingsdag wanneer die er zijn.
  // (Na de dag-backfill zitten alle items in een dag; oudere schema's vallen
  // terug op de platte items-lijst.) Is er een dag gekozen, dan filteren we tot
  // die dag en tonen we altijd de dagnaam als kop (bevestiging welke dag je doet).
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
    // Origineel = het template-item; vervanger (indien gekozen) neemt de identiteit
    // over, maar het set/rep-schema + type van het origineel blijven behouden.
    const originalId = item.exerciseId;
    const sub = subByOriginal.get(originalId);
    const subTarget = sub ? subTargetById.get(sub.to) : undefined;
    const renderedId = subTarget ? subTarget.id : originalId;

    const own = entries.filter((e) => e.exerciseId === renderedId);
    // Bestaande opmerking: eerst een eerder opgeslagen set-notitie, anders de
    // streef-notitie die de trainer bij de oefening zette.
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

  const context = await getWorkoutContext(open.id, member.id, member.tenantId);

  // Afrondscherm-beloning: herstelboodschap (altijd) + motiverende quote (alleen
  // als de sportschool het aanheeft én het lid het niet heeft uitgezet). Beide
  // deterministisch per sessie → stabiel binnen een training, afwisselend erna.
  const [tenant, userRow] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: member.tenantId },
      select: { quotesEnabled: true, customQuotes: true },
    }),
    prisma.user.findUnique({
      where: { id: member.id },
      select: { preferences: true },
    }),
  ]);
  const quotesOn = (tenant?.quotesEnabled ?? true) && !getHideQuotes(userRow?.preferences);
  const reward = {
    initialMood: open.mood ?? null,
    recoveryTip: pickRecoveryTip(open.id),
    quote: quotesOn ? pickQuote(resolveQuotes(tenant?.customQuotes), open.id) : null,
  };

  // Timers standaard aan, tenzij het lid ze globaal heeft uitgezet. De actieve
  // sessie kan dit per training overschrijven (client-side, per sessie).
  const timersDefaultOn = !getDisableSetTimers(userRow?.preferences);

  return (
    <ActiveSession
      sessionId={open.id}
      startedAt={open.startedAt.toISOString()}
      exercises={exercises}
      context={context}
      reward={reward}
      timersDefaultOn={timersDefaultOn}
    />
  );
}
