"use client";

import { useState } from "react";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { Dumbbell, Trophy } from "@/components/ui/icons";
import type { ActiveExercise, SetValue } from "./active-session";

/** Grote, zweethanden-proof stepper voor gewicht/herhalingen tijdens de workout. */
function BigStepper({
  value,
  unit,
  step,
  onChange,
}: {
  value: string;
  unit: string;
  step: number;
  onChange: (next: string) => void;
}) {
  function bump(delta: number) {
    const cur = Number(value || 0);
    const next = Math.max(0, Math.round((cur + delta) * 100) / 100);
    onChange(String(next));
  }
  return (
    <div className="flex w-full flex-col items-center">
      <span className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
        {unit}
      </span>
      <div className="flex w-full items-center gap-1.5">
        <button
          type="button"
          aria-label={`${unit} omlaag`}
          onClick={() => bump(-step)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-2xl font-bold text-neutral-600 active:scale-90"
        >
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 rounded-xl border border-border bg-surface-0 px-1 py-2 text-center font-display text-xl font-bold leading-none tabular-nums text-neutral-900 outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={`${unit} omhoog`}
          onClick={() => bump(step)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-2xl font-bold text-neutral-600 active:scale-90"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Eén oefening in beeld tijdens de Workout Mode — de primaire focus. Grote hero,
 * grote cijfers, één set tegelijk benadrukt, grote afvink-knop. Toont een live
 * PR-badge zodra een afgevinkte set de historische beste 1RM overtreft.
 */
export function WorkoutFocusCard({
  exercise,
  index,
  total,
  sets,
  note,
  nextExerciseName,
  historicalBestOneRm,
  onChangeSet,
  onToggleSet,
  onNoteChange,
  onNoteBlur,
}: {
  exercise: ActiveExercise;
  index: number;
  total: number;
  sets: SetValue[];
  note: string;
  nextExerciseName: string | null;
  historicalBestOneRm: number;
  onChangeSet: (setNumber: number, field: "reps" | "kg", value: string) => void;
  onToggleSet: (setNumber: number) => void;
  onNoteChange: (value: string) => void;
  onNoteBlur: () => void;
}) {
  const [showNote, setShowNote] = useState(Boolean(note));
  const doneCount = sets.filter((s) => s.done).length;
  const activeSet = sets.findIndex((s) => !s.done); // eerstvolgende open set

  // Live PR: beste geschatte 1RM van de afgevinkte sets vs. historische beste.
  const liveBest = sets.reduce((best, s) => {
    if (!s.done) return best;
    const kg = Number(s.kg || 0);
    const reps = Number(s.reps || 0);
    if (kg <= 0) return best;
    return Math.max(best, kg * (1 + reps / 30));
  }, 0);
  const isPr = liveBest > 0 && historicalBestOneRm > 0 && liveBest > historicalBestOneRm;

  return (
    <div className="flex flex-col gap-4">
      {/* Kop */}
      <div className="flex items-start gap-3">
        {exercise.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exercise.thumbUrl}
            alt=""
            aria-hidden
            className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-sm"
          />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Dumbbell className="size-8" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-500">
              {index + 1} / {total}
            </span>
            {isPr ? (
              <m.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground"
              >
                <Trophy className="size-3" /> Nieuwe PR
              </m.span>
            ) : null}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-neutral-900">
            {exercise.name}
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            doel: {exercise.sets} × {exercise.targetReps}
            {exercise.targetWeightKg ? ` · ${exercise.targetWeightKg} kg` : ""}
            {exercise.machineName ? ` · ${exercise.machineName}` : ""}
          </p>
        </div>
      </div>

      {/* Sets */}
      <div className="flex flex-col gap-2.5">
        {sets.map((s, i) => {
          const setNumber = i + 1;
          const isActive = i === activeSet;
          return (
            <m.div
              key={setNumber}
              animate={{ opacity: s.done || isActive ? 1 : 0.65 }}
              className={cn(
                "rounded-2xl border p-3 transition-colors",
                s.done
                  ? "border-accent/40 bg-accent-soft"
                  : isActive
                    ? "border-accent ring-2 ring-accent/25 bg-surface-1"
                    : "border-border bg-surface-1"
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-sm font-bold text-neutral-600">
                  {setNumber}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <BigStepper
                    value={s.kg}
                    unit="kg"
                    step={2.5}
                    onChange={(v) => onChangeSet(setNumber, "kg", v)}
                  />
                  <BigStepper
                    value={s.reps}
                    unit="reps"
                    step={1}
                    onChange={(v) => onChangeSet(setNumber, "reps", v)}
                  />
                </div>
                <button
                  type="button"
                  aria-label={s.done ? `Set ${setNumber} ongedaan maken` : `Set ${setNumber} afvinken`}
                  aria-pressed={s.done}
                  onClick={() => onToggleSet(setNumber)}
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 text-2xl font-bold transition-colors active:scale-90",
                    s.done
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-neutral-300 text-neutral-300"
                  )}
                >
                  {s.saving ? (
                    <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    "✓"
                  )}
                </button>
              </div>
            </m.div>
          );
        })}
      </div>

      {/* Opmerking */}
      {showNote ? (
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          onBlur={onNoteBlur}
          rows={2}
          maxLength={500}
          placeholder="Opmerking (bijv. voelde zwaar, let op vorm)…"
          className="w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="self-start text-sm font-medium text-neutral-500 active:text-neutral-900"
        >
          ＋ Opmerking toevoegen
        </button>
      )}

      {/* Volgende-preview */}
      {nextExerciseName ? (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-neutral-500">
          Hierna:{" "}
          <span className="font-semibold text-neutral-800">{nextExerciseName}</span>
        </p>
      ) : doneCount === sets.length ? (
        <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm font-medium text-accent">
          Laatste oefening — rond je workout af 💪
        </p>
      ) : null}
    </div>
  );
}
