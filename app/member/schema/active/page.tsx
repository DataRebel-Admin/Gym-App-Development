import { redirect } from "next/navigation";
import { requireMember } from "@/lib/member";
import { enforceSessionTimeout } from "@/lib/session-timeout";
import { buildActiveSessionView } from "@/lib/active-session-view";
import { ActiveSession, type SessionActions } from "./active-session";
import {
  saveSet,
  saveLog,
  saveExerciseNote,
  skipExercise,
  unskipExercise,
  getExerciseAlternatives,
  substituteExercise,
  saveWorkoutMood,
  cancelSession,
  endSession,
} from "../actions";

export const metadata = { title: "Actieve training" };

// De lid-flow injecteert de zelf-gescoopte lid-actions (subject = het ingelogde
// lid; requireMember bewaakt elke action). De trainer-flow injecteert dezelfde
// bundel met op het lid gebonden trainer-varianten.
const MEMBER_ACTIONS: SessionActions = {
  saveSet,
  saveLog,
  saveExerciseNote,
  skipExercise,
  unskipExercise,
  getExerciseAlternatives,
  substituteExercise,
  saveWorkoutMood,
  cancelSession,
  endSession,
};

export default async function ActiveSessionPage() {
  const member = await requireMember();

  // Automatische 5-uur-timeout: sluit een te lang openstaande sessie eerst af.
  const timeout = await enforceSessionTimeout(member.tenantId, member.id);
  if (timeout.autoStopped || !timeout.sessionId) redirect("/member/schema");

  const view = await buildActiveSessionView(member.tenantId, member.id, timeout.sessionId);
  if (!view) redirect("/member/schema");

  return (
    <ActiveSession
      sessionId={timeout.sessionId}
      startedAt={view.startedAt}
      exercises={view.exercises}
      context={view.context}
      reward={view.reward}
      timersDefaultOn={view.timersDefaultOn}
      actions={MEMBER_ACTIONS}
    />
  );
}
