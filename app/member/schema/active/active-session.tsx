"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { saveSet, saveExerciseNote } from "../actions";
import { ExerciseBlock } from "./exercise-block";
import { CompletionScreen } from "./completion-screen";
import { useRestTimer, FloatingTimer } from "./rest-timer";
import { Fullscreenable, FullscreenButton } from "@/components/ui/fullscreen";
import { Check } from "@/components/ui/icons";

/** Lokale (optimistische) staat van één set. */
export type SetValue = { reps: string; kg: string; done: boolean; saving: boolean };

type SetEntry = { setNumber: number; reps: number; weightKg: number };
export type PreviousPerformance = {
  date: string;
  sets: { setNumber: number; reps: number; weightKg: number }[];
};
export type ActiveExercise = {
  exerciseId: string;
  name: string;
  machineName: string | null;
  thumbUrl: string | null;
  dayName: string | null;
  sets: number;
  targetReps: number;
  targetWeightKg: number | null;
  restSeconds: number;
  note: string | null;
  entries: SetEntry[];
  previous: PreviousPerformance | null;
};

export type WorkoutContextProps = {
  historicalBest: Record<string, number>;
  projectedStreakWeeks: number;
  weeklyGoal: number;
  weeklyGoalReached: boolean;
  workoutsThisWeekIncl: number;
};

const DEFAULT_REST = 90;

function fmtClock(totalSec: number) {
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function emptySet(): SetValue {
  return { reps: "", kg: "", done: false, saving: false };
}

/**
 * Orkestreert de actieve training als één doorlopende lijst: alle oefeningen
 * onder elkaar (continuous scroll), per oefening de sets met grote steppers,
 * een "vorige keer"-regel en de mogelijkheid extra sets toe te voegen. Sticky
 * voortgangsbalk, meelopende rusttimer en afrond-scherm blijven behouden. Alle
 * opslag-logica (saveSet/saveExerciseNote optimistisch) is ongewijzigd.
 */
export function ActiveSession({
  sessionId,
  startedAt,
  exercises,
  context,
}: {
  sessionId: string;
  startedAt: string;
  exercises: ActiveExercise[];
  context: WorkoutContextProps;
}) {
  const timer = useRestTimer();
  const [, startTransition] = useTransition();

  const [setState, setSetState] = useState<Record<string, SetValue[]>>(() => {
    const init: Record<string, SetValue[]> = {};
    for (const ex of exercises) {
      // Aantal sets = template, maar minstens zoveel als er al opgeslagen zijn
      // (zo blijven eerder toegevoegde extra sets behouden na herladen).
      const maxEntry = ex.entries.reduce((m, e) => Math.max(m, e.setNumber), 0);
      const len = Math.max(ex.sets, maxEntry, 1);
      init[ex.exerciseId] = Array.from({ length: len }, (_, i) => {
        const entry = ex.entries.find((e) => e.setNumber === i + 1);
        return {
          reps: entry ? String(entry.reps) : "",
          kg: entry ? String(entry.weightKg) : "",
          done: Boolean(entry),
          saving: false,
        };
      });
    }
    return init;
  });

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const ex of exercises) init[ex.exerciseId] = ex.note ?? "";
    return init;
  });

  const [showCompletion, setShowCompletion] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  function patchSet(exerciseId: string, idx: number, patch: Partial<SetValue>) {
    setSetState((prev) => {
      const arr = prev[exerciseId].slice();
      arr[idx] = { ...arr[idx], ...patch };
      return { ...prev, [exerciseId]: arr };
    });
  }

  function changeSet(exerciseId: string, setNumber: number, field: "reps" | "kg", value: string) {
    patchSet(exerciseId, setNumber - 1, { [field]: value });
  }

  function addSet(exerciseId: string) {
    setSetState((prev) => {
      if (prev[exerciseId].length >= 20) return prev;
      return { ...prev, [exerciseId]: [...prev[exerciseId], emptySet()] };
    });
  }

  function removeSet(exerciseId: string, setNumber: number) {
    setSetState((prev) => {
      const arr = prev[exerciseId];
      const idx = setNumber - 1;
      // Veiligheid: alleen de laatste, nog niet afgevinkte set verwijderen.
      if (idx !== arr.length - 1 || arr[idx]?.done) return prev;
      return { ...prev, [exerciseId]: arr.slice(0, -1) };
    });
  }

  function toggleSet(ex: ActiveExercise, setNumber: number) {
    const idx = setNumber - 1;
    const cur = setState[ex.exerciseId][idx];
    const nextDone = !cur.done;

    if (!nextDone) {
      patchSet(ex.exerciseId, idx, { done: false });
      return;
    }

    // Lege velden vallen terug op de vorige keer, anders het schema-doel.
    const prevSet = ex.previous?.sets.find((s) => s.setNumber === setNumber);
    const reps = Number(cur.reps || prevSet?.reps || ex.targetReps || 0);
    const fallbackKg =
      prevSet && prevSet.weightKg > 0
        ? prevSet.weightKg
        : ex.targetWeightKg != null
          ? ex.targetWeightKg
          : 0;
    const kg = Number(cur.kg || fallbackKg || 0);
    patchSet(ex.exerciseId, idx, {
      done: true,
      saving: true,
      reps: String(reps),
      kg: cur.kg || (fallbackKg ? String(fallbackKg) : ""),
    });

    startTransition(async () => {
      await saveSet({ sessionId, exerciseId: ex.exerciseId, setNumber, reps, weightKg: kg });
      patchSet(ex.exerciseId, idx, { saving: false });
    });

    if (timer.vibrateOn && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(15);
    }
    timer.startRest(ex.restSeconds > 0 ? ex.restSeconds : DEFAULT_REST);
  }

  function noteBlur(exerciseId: string) {
    const value = notes[exerciseId] ?? "";
    startTransition(async () => {
      await saveExerciseNote({ sessionId, exerciseId, notes: value });
    });
  }

  // Voortgang + live samenvatting (voor header + completion-scherm).
  const stats = useMemo(() => {
    let completedSets = 0;
    let totalSets = 0;
    let completedExercises = 0;
    let totalVolume = 0;
    let totalReps = 0;
    let estRestSec = 0;
    let estRemainingSec = 0;
    const newRecords: { name: string; weightKg: number; reps: number }[] = [];

    for (const ex of exercises) {
      const sets = setState[ex.exerciseId];
      totalSets += sets.length;
      const doneSets = sets.filter((s) => s.done);
      completedSets += doneSets.length;
      if (sets.length > 0 && doneSets.length === sets.length) completedExercises += 1;

      let liveBest = 0;
      let bestSet: { weightKg: number; reps: number } | null = null;
      for (const s of doneSets) {
        const kg = Number(s.kg || 0);
        const reps = Number(s.reps || 0);
        totalVolume += reps * kg;
        totalReps += reps;
        estRestSec += ex.restSeconds || DEFAULT_REST;
        if (kg > 0) {
          const oneRm = kg * (1 + reps / 30);
          if (oneRm > liveBest) {
            liveBest = oneRm;
            bestSet = { weightKg: kg, reps };
          }
        }
      }
      const historical = context.historicalBest[ex.exerciseId] ?? 0;
      if (bestSet && historical > 0 && liveBest > historical) {
        newRecords.push({ name: ex.name, weightKg: bestSet.weightKg, reps: bestSet.reps });
      }
      const remain = sets.length - doneSets.length;
      estRemainingSec += remain * ((ex.restSeconds || DEFAULT_REST) + 30);
    }

    return {
      completedSets,
      totalSets,
      completedExercises,
      totalVolume,
      totalReps,
      estRestSec,
      estRemainingSec,
      newRecords,
    };
  }, [exercises, setState, context.historicalBest]);

  const pct = stats.totalSets > 0 ? Math.round((stats.completedSets / stats.totalSets) * 100) : 0;
  const allDone = stats.completedExercises === exercises.length;

  // Meelopende workout-klok.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const completionVisible = (allDone || showCompletion) && !dismissed;

  return (
    <Fullscreenable className="relative flex flex-1 flex-col">
      {/* Sticky voortgangsbalk */}
      <div className="sticky top-[3.25rem] z-30 border-b border-border bg-surface-1/85 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-neutral-700">
            <span className="tabular-nums">
              {stats.completedExercises}/{exercises.length}
            </span>
            <span className="text-neutral-400">klaar</span>
          </span>
          <div className="flex-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <m.div
                className="h-full rounded-full bg-accent-gradient"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
          <span className="shrink-0 font-display text-sm font-bold tabular-nums text-neutral-700">
            {pct}%
          </span>
          <span className="shrink-0 font-display text-sm font-bold tabular-nums text-neutral-500">
            {fmtClock(elapsed)}
          </span>
          <FullscreenButton />
        </div>
      </div>

      {/* Doorlopende oefeningenlijst */}
      <div className="flex flex-1 flex-col gap-5 px-4 pb-44 pt-5">
        {exercises.map((ex, i) => {
          const showDay = Boolean(ex.dayName) && ex.dayName !== exercises[i - 1]?.dayName;
          return (
            <div key={ex.exerciseId} className="flex flex-col gap-2">
              {showDay ? (
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-accent">
                  {ex.dayName}
                </p>
              ) : null}
              <ExerciseBlock
                exercise={ex}
                sets={setState[ex.exerciseId]}
                note={notes[ex.exerciseId] ?? ""}
                historicalBestOneRm={context.historicalBest[ex.exerciseId] ?? 0}
                onChangeSet={(sn, field, val) => changeSet(ex.exerciseId, sn, field, val)}
                onToggleSet={(sn) => toggleSet(ex, sn)}
                onAddSet={() => addSet(ex.exerciseId)}
                onRemoveSet={(sn) => removeSet(ex.exerciseId, sn)}
                onNoteChange={(val) => setNotes((p) => ({ ...p, [ex.exerciseId]: val }))}
                onNoteBlur={() => noteBlur(ex.exerciseId)}
              />
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setDismissed(false);
            setShowCompletion(true);
          }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-6 py-4 text-center text-base font-bold text-accent-foreground shadow-accent active:scale-[0.98]"
        >
          <Check className="size-5" /> Workout afronden
        </button>
      </div>

      <FloatingTimer timer={timer} />

      <AnimatePresence>
        {completionVisible ? (
          <CompletionScreen
            sessionId={sessionId}
            completedExercises={stats.completedExercises}
            totalExercises={exercises.length}
            completedSets={stats.completedSets}
            totalReps={stats.totalReps}
            totalVolume={stats.totalVolume}
            durationSec={elapsed}
            estRestSec={stats.estRestSec}
            newRecords={stats.newRecords}
            streakWeeks={context.projectedStreakWeeks}
            weeklyGoal={context.weeklyGoal}
            weeklyGoalReached={context.weeklyGoalReached}
            workoutsThisWeek={context.workoutsThisWeekIncl}
            onContinue={() => {
              setShowCompletion(false);
              setDismissed(true);
            }}
          />
        ) : null}
      </AnimatePresence>
    </Fullscreenable>
  );
}
