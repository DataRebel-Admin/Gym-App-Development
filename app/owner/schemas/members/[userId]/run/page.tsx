import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getAssignedSchema } from "@/lib/member";
import { enforceSessionTimeout } from "@/lib/session-timeout";
import { resolveTrainedMember } from "@/lib/trainer-session";
import { buildActiveSessionView } from "@/lib/active-session-view";
import { Play, Dumbbell, CalendarDays } from "@/components/ui/icons";
import { ActiveSession, type SessionActions } from "@/app/member/schema/active/active-session";
import {
  startTrainerSession,
  saveSetFor,
  saveLogFor,
  saveNoteFor,
  skipFor,
  unskipFor,
  getAlternativesFor,
  substituteFor,
  saveMoodFor,
  cancelSessionFor,
  endSessionFor,
} from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const tenant = await getCurrentTenant();
  const member = tenant
    ? await prisma.user.findFirst({
        where: { id: userId, tenantId: tenant.id, role: "TENANT_MEMBER" },
        select: { name: true, email: true },
      })
    : null;
  const label = member?.name ?? member?.email ?? "Lid";
  return { title: `Workout draaien | ${label}` };
}

export default async function TrainerRunPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  // Autorisatie: schemas:manage + het lid hoort bij de eigen tenant (anders 404).
  const { member } = await resolveTrainedMember(userId);

  // Automatische 5-uur-timeout: sluit een te lang openstaande sessie af.
  const timeout = await enforceSessionTimeout(member.tenantId, member.id);

  const memberLabel = member.name ?? member.email;
  const backHref = `/owner/schemas/members/${userId}`;

  // Loopt er een sessie? Dan de actieve-trainingsweergave (met trainer-actions).
  if (!timeout.autoStopped && timeout.sessionId) {
    const view = await buildActiveSessionView(member.tenantId, member.id, timeout.sessionId);
    if (view) {
      const actions: SessionActions = {
        saveSet: saveSetFor.bind(null, userId),
        saveLog: saveLogFor.bind(null, userId),
        saveExerciseNote: saveNoteFor.bind(null, userId),
        skipExercise: skipFor.bind(null, userId),
        unskipExercise: unskipFor.bind(null, userId),
        getExerciseAlternatives: getAlternativesFor.bind(null, userId),
        substituteExercise: substituteFor.bind(null, userId),
        saveWorkoutMood: saveMoodFor.bind(null, userId),
        cancelSession: cancelSessionFor.bind(null, userId),
        endSession: endSessionFor.bind(null, userId),
      };
      return (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <div className="border-b border-border bg-surface-1 px-4 py-2.5">
            <p className="text-xs text-neutral-500">
              Je draait deze workout voor{" "}
              <span className="font-semibold text-neutral-800">{memberLabel}</span>
            </p>
          </div>
          <ActiveSession
            sessionId={timeout.sessionId}
            startedAt={view.startedAt}
            exercises={view.exercises}
            context={view.context}
            reward={view.reward}
            timersDefaultOn={view.timersDefaultOn}
            actions={actions}
          />
        </div>
      );
    }
  }

  // Geen open sessie → startscherm: kies de trainingsdag en start.
  const assignment = await getAssignedSchema(member.id, member.tenantId);
  const schema = assignment?.template;
  const dayOptions =
    schema?.days.map((d) => ({ id: d.id, name: d.name, count: d.items.length })) ?? [];
  const multiDay = dayOptions.length > 1;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
      <div>
        <Link href={backHref} className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Terug naar lid
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-neutral-900">Workout draaien</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Voor <span className="font-medium text-neutral-800">{memberLabel}</span> — de
          resultaten tellen als training van het lid.
        </p>
      </div>

      {!schema ? (
        <div className="rounded-2xl border border-border bg-surface-1 p-5 text-sm text-neutral-600">
          <p className="flex items-center gap-2 font-medium text-neutral-800">
            <Dumbbell className="size-4 text-accent" /> Geen actief schema
          </p>
          <p className="mt-1">
            Dit lid heeft nog geen actief (gepubliceerd) schema. Wijs eerst een schema toe.
          </p>
          <Link
            href={backHref}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground active:opacity-90"
          >
            Schema beheren →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">{schema.name}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-neutral-600">
              <Dumbbell className="size-3.5 text-accent" /> {schema.items.length} oef.
            </span>
            {multiDay ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-neutral-600">
                <CalendarDays className="size-3.5 text-accent" /> {dayOptions.length} dagen
              </span>
            ) : null}
          </div>

          {multiDay ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-neutral-700">Kies de trainingsdag</p>
              {dayOptions.map((d) => (
                <form key={d.id} action={startTrainerSession.bind(null, userId)}>
                  <input type="hidden" name="dayId" value={d.id} />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-accent-gradient px-5 py-3.5 text-left font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98]"
                  >
                    <span className="flex items-center gap-2">
                      <Play className="size-5 fill-current" /> {d.name}
                    </span>
                    <span className="text-sm font-medium text-accent-foreground/80">
                      {d.count} oef.
                    </span>
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <form action={startTrainerSession.bind(null, userId)}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-6 py-4 text-center text-base font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98]"
              >
                <Play className="size-5 fill-current" /> Start training
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
