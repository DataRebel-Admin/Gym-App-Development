"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import { saveSet, saveExerciseNote } from "../actions";
import { WorkoutFocusCard } from "./workout-focus-card";
import { CompletionScreen } from "./completion-screen";
import { useRestTimer, FloatingTimer } from "./rest-timer";
import { Fullscreenable, FullscreenButton } from "@/components/ui/fullscreen";
import { ChevronLeft, ChevronRight, Check } from "@/components/ui/icons";

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

/**
 * Orkestreert de Workout Mode: één oefening tegelijk in beeld (swipe/knoppen),
 * met sticky voortgang, meelopende rusttimer en een afrond-scherm. Alle
 * set-/opslag-logica (saveSet/saveExerciseNote optimistisch, endSession via het
 * completion-scherm) blijft ongewijzigd; alleen de presentatie is herzien naar
 * een distraction-free focus-modus.
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

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const ex of exercises) init[ex.exerciseId] = ex.note ?? "";
    return init;
  });

  // Welke oefening is in beeld (start bij de eerste onafgeronde).
  const firstUnfinished = Math.max(
    0,
    exercises.findIndex((ex) =>
      Array.from({ length: ex.sets }, (_, i) => i).some(
        (i) => !setState[ex.exerciseId][i].done
      )
    )
  );
  const [viewIndex, setViewIndex] = useState(firstUnfinished);
  const [dir, setDir] = useState(0); // richting voor slide-animatie
  const [showOverview, setShowOverview] = useState(false);
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

  function toggleSet(ex: ActiveExercise, setNumber: number) {
    const idx = setNumber - 1;
    const cur = setState[ex.exerciseId][idx];
    const nextDone = !cur.done;

    if (!nextDone) {
      patchSet(ex.exerciseId, idx, { done: false });
      return;
    }

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

  const exerciseDone = (ex: ActiveExercise) => setState[ex.exerciseId].every((s) => s.done);

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
      totalSets += ex.sets;
      const doneSets = sets.filter((s) => s.done);
      completedSets += doneSets.length;
      if (doneSets.length === ex.sets) completedExercises += 1;

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
      // Nieuwe PR alleen melden als er een eerdere beste was die we overtreffen.
      const historical = context.historicalBest[ex.exerciseId] ?? 0;
      if (bestSet && historical > 0 && liveBest > historical) {
        newRecords.push({ name: ex.name, weightKg: bestSet.weightKg, reps: bestSet.reps });
      }
      const remain = ex.sets - doneSets.length;
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

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(exercises.length - 1, next));
    setDir(clamped > viewIndex ? 1 : -1);
    setViewIndex(clamped);
    setShowOverview(false);
  }

  const current = exercises[viewIndex];
  const next = exercises.slice(viewIndex + 1).find((e) => !exerciseDone(e));
  const currentDone = exerciseDone(current);
  const isLast = viewIndex === exercises.length - 1;
  const completionVisible = (allDone || showCompletion) && !dismissed;

  return (
    <Fullscreenable className="relative flex flex-1 flex-col">
      {/* Sticky voortgangsbalk */}
      <div className="sticky top-[3.25rem] z-30 border-b border-border bg-surface-1/85 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowOverview((v) => !v)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-neutral-700 active:scale-95"
          >
            <span className="tabular-nums">
              {viewIndex + 1}/{exercises.length}
            </span>
            <span className="text-neutral-400">oefeningen</span>
          </button>
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

      {/* Focus-kaart */}
      <div className="flex-1 px-4 pb-44 pt-5">
        {current.dayName ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
            {current.dayName}
          </p>
        ) : null}

        <AnimatePresence mode="wait" custom={dir}>
          <m.div
            key={current.exerciseId}
            custom={dir}
            initial={{ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir > 0 ? -40 : 40 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80 && viewIndex < exercises.length - 1) goTo(viewIndex + 1);
              else if (info.offset.x > 80 && viewIndex > 0) goTo(viewIndex - 1);
            }}
          >
            <WorkoutFocusCard
              exercise={current}
              index={viewIndex}
              total={exercises.length}
              sets={setState[current.exerciseId]}
              note={notes[current.exerciseId] ?? ""}
              nextExerciseName={next?.name ?? null}
              historicalBestOneRm={context.historicalBest[current.exerciseId] ?? 0}
              onChangeSet={(sn, field, val) => changeSet(current.exerciseId, sn, field, val)}
              onToggleSet={(sn) => toggleSet(current, sn)}
              onNoteChange={(val) => setNotes((p) => ({ ...p, [current.exerciseId]: val }))}
              onNoteBlur={() => noteBlur(current.exerciseId)}
            />
          </m.div>
        </AnimatePresence>

        {/* Navigatie */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => goTo(viewIndex - 1)}
            disabled={viewIndex === 0}
            aria-label="Vorige oefening"
            className="flex w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-1 py-4 text-neutral-700 disabled:opacity-30 active:scale-95"
          >
            <ChevronLeft className="size-6" />
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={() => {
                setDismissed(false);
                setShowCompletion(true);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-6 py-4 text-center text-base font-bold text-accent-foreground shadow-accent active:scale-[0.98]"
            >
              <Check className="size-5" /> Workout afronden
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goTo(viewIndex + 1)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-center text-base font-bold transition-colors active:scale-[0.98]",
                currentDone
                  ? "bg-accent-gradient text-accent-foreground shadow-accent"
                  : "bg-foreground text-background shadow-md"
              )}
            >
              {currentDone ? "Volgende oefening" : "Volgende"}
              <ChevronRight className="size-5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setDismissed(false);
            setShowCompletion(true);
          }}
          className="mt-3 w-full text-center text-sm font-medium text-neutral-500 active:text-neutral-900"
        >
          Workout nu afronden
        </button>
      </div>

      {/* Overzicht-sheet */}
      <AnimatePresence>
        {showOverview ? (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={() => setShowOverview(false)}
          >
            <m.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 bottom-0 mx-auto max-h-[70vh] max-w-md overflow-y-auto rounded-t-3xl border-t border-border bg-surface-1 p-4 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-neutral-300" />
              <h2 className="mb-3 font-display text-lg font-bold text-neutral-900">
                Oefeningen
              </h2>
              <ul className="flex flex-col gap-1.5">
                {exercises.map((ex, i) => {
                  const done = exerciseDone(ex);
                  const doneSets = setState[ex.exerciseId].filter((s) => s.done).length;
                  return (
                    <li key={ex.exerciseId}>
                      <button
                        type="button"
                        onClick={() => goTo(i)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left active:scale-[0.99]",
                          i === viewIndex
                            ? "border-accent ring-1 ring-accent/30 bg-accent-soft"
                            : "border-border bg-surface-0"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            done
                              ? "bg-accent text-accent-foreground"
                              : "bg-surface-2 text-neutral-500"
                          )}
                        >
                          {done ? "✓" : i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-neutral-900">
                            {ex.name}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {doneSets}/{ex.sets} sets
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </m.div>
          </m.div>
        ) : null}
      </AnimatePresence>

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
