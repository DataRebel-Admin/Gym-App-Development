"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence } from "motion/react";
import { saveSet, saveExerciseNote } from "../actions";
import { ExerciseCard } from "./exercise-card";
import { WorkoutProgress } from "./workout-progress";
import { CompletionScreen } from "./completion-screen";
import { useRestTimer, FloatingTimer } from "./rest-timer";
import { Fullscreenable, FullscreenButton } from "@/components/ui/fullscreen";

/** Lokale (optimistische) staat van één set. */
export type SetValue = { reps: string; kg: string; done: boolean; saving: boolean };

type SetEntry = { setNumber: number; reps: number; weightKg: number };
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
};

const DEFAULT_REST = 90;

/**
 * Orkestreert de actieve training: per-set staat, opslaan (optimistisch), de
 * meelopende rusttimer en het voltooid-scherm. De presentatie zit in losse
 * componenten ([[exercise-card]], [[workout-progress]], [[rest-timer]],
 * [[completion-screen]]); de businesslogica (saveSet/saveExerciseNote/endSession)
 * blijft ongewijzigd.
 */
export function ActiveSession({
  sessionId,
  startedAt,
  exercises,
}: {
  sessionId: string;
  startedAt: string;
  exercises: ActiveExercise[];
}) {
  const timer = useRestTimer();
  const [, startTransition] = useTransition();
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  // Set-staat per oefening, vooraf gevuld vanuit reeds opgeslagen prestaties.
  const [setState, setSetState] = useState<Record<string, SetValue[]>>(() => {
    const init: Record<string, SetValue[]> = {};
    for (const ex of exercises) {
      init[ex.exerciseId] = Array.from({ length: ex.sets }, (_, i) => {
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

  // Opmerking per oefening (trainer-notitie of eerder opgeslagen).
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

  function changeSet(
    exerciseId: string,
    setNumber: number,
    field: "reps" | "kg",
    value: string
  ) {
    patchSet(exerciseId, setNumber - 1, { [field]: value });
  }

  function toggleSet(ex: ActiveExercise, setNumber: number) {
    const idx = setNumber - 1;
    const cur = setState[ex.exerciseId][idx];
    const nextDone = !cur.done;

    if (!nextDone) {
      patchSet(ex.exerciseId, idx, { done: false });
      return;
    }

    // Afvinken: vul lege velden met de streefwaarden en sla optimistisch op.
    const reps = Number(cur.reps || ex.targetReps || 0);
    const kg = Number(cur.kg || ex.targetWeightKg || 0);
    patchSet(ex.exerciseId, idx, {
      done: true,
      saving: true,
      reps: String(reps),
      kg: cur.kg || (ex.targetWeightKg != null ? String(ex.targetWeightKg) : ""),
    });

    startTransition(async () => {
      await saveSet({ sessionId, exerciseId: ex.exerciseId, setNumber, reps, weightKg: kg });
      patchSet(ex.exerciseId, idx, { saving: false });
    });

    // Haptische tik + automatische rusttimer.
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

  // Voortgang + samenvatting.
  const stats = useMemo(() => {
    let completedSets = 0;
    let totalSets = 0;
    let completedExercises = 0;
    let totalVolume = 0;
    let estRemainingSec = 0;
    for (const ex of exercises) {
      const sets = setState[ex.exerciseId];
      totalSets += ex.sets;
      const doneCount = sets.filter((s) => s.done).length;
      completedSets += doneCount;
      if (doneCount === ex.sets) completedExercises += 1;
      for (const s of sets) {
        if (s.done) totalVolume += Number(s.reps || 0) * Number(s.kg || 0);
      }
      const remain = ex.sets - doneCount;
      estRemainingSec += remain * ((ex.restSeconds || DEFAULT_REST) + 30);
    }
    return { completedSets, totalSets, completedExercises, totalVolume, estRemainingSec };
  }, [exercises, setState]);

  const exerciseDone = (ex: ActiveExercise) =>
    setState[ex.exerciseId].every((s) => s.done);
  const currentIndex = exercises.findIndex((ex) => !exerciseDone(ex));
  const allDone = currentIndex < 0;
  const currentId = currentIndex >= 0 ? exercises[currentIndex].exerciseId : null;

  // Scroll de huidige oefening in beeld zodra hij wisselt.
  useEffect(() => {
    if (!currentId) return;
    cardRefs.current[currentId]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentId]);

  const durationSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  );
  const completionVisible = (allDone || showCompletion) && !dismissed;

  return (
    <Fullscreenable className="flex flex-1 flex-col gap-4 px-4 pb-44 pt-5">
      <div className="flex justify-end">
        <FullscreenButton />
      </div>

      <WorkoutProgress
        completedSets={stats.completedSets}
        totalSets={stats.totalSets}
        completedExercises={stats.completedExercises}
        totalExercises={exercises.length}
        estRemainingSec={stats.estRemainingSec}
        startedAt={startedAt}
      />

      <div className="flex flex-col gap-3">
        {exercises.map((ex, i) => {
          const showDay = ex.dayName && ex.dayName !== exercises[i - 1]?.dayName;
          const nextEx =
            i === currentIndex
              ? exercises.slice(i + 1).find((e) => !exerciseDone(e))
              : undefined;
          return (
            <Fragment key={ex.exerciseId}>
              {showDay ? (
                <h2 className="mt-1 px-1 text-sm font-semibold text-neutral-900">
                  {ex.dayName}
                </h2>
              ) : null}
              <ExerciseCard
                exercise={ex}
                index={i}
                total={exercises.length}
                isCurrent={i === currentIndex}
                nextExerciseName={nextEx?.name ?? null}
                sets={setState[ex.exerciseId]}
                note={notes[ex.exerciseId] ?? ""}
                onChangeSet={(sn, field, val) => changeSet(ex.exerciseId, sn, field, val)}
                onToggleSet={(sn) => toggleSet(ex, sn)}
                onNoteChange={(val) =>
                  setNotes((p) => ({ ...p, [ex.exerciseId]: val }))
                }
                onNoteBlur={() => noteBlur(ex.exerciseId)}
                cardRef={(el) => {
                  cardRefs.current[ex.exerciseId] = el;
                }}
              />
            </Fragment>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          setDismissed(false);
          setShowCompletion(true);
        }}
        className="mt-1 w-full rounded-2xl bg-foreground px-6 py-4 text-center text-lg font-bold text-background shadow-md active:scale-[0.98]"
      >
        Workout afronden
      </button>

      <FloatingTimer timer={timer} />

      <AnimatePresence>
        {completionVisible ? (
          <CompletionScreen
            sessionId={sessionId}
            completedExercises={stats.completedExercises}
            totalExercises={exercises.length}
            completedSets={stats.completedSets}
            totalVolume={stats.totalVolume}
            durationSec={durationSec}
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
