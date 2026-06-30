"use client";

import { useState } from "react";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import type { ActiveExercise, SetValue } from "./active-session";

function Stepper({
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
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`${unit} omlaag`}
        onClick={() => bump(-step)}
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-xl font-bold text-neutral-700 active:scale-95"
      >
        −
      </button>
      <div className="flex w-16 flex-col items-center">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-0 px-1 py-1.5 text-center text-base font-semibold tabular-nums text-neutral-900 outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="mt-0.5 text-[11px] text-neutral-500">{unit}</span>
      </div>
      <button
        type="button"
        aria-label={`${unit} omhoog`}
        onClick={() => bump(step)}
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-xl font-bold text-neutral-700 active:scale-95"
      >
        +
      </button>
    </div>
  );
}

/**
 * Kaart voor één oefening tijdens de training. De huidige oefening wordt
 * uitgelicht; afgeronde oefeningen dimmen. Per set: snel gewicht/herhalingen
 * bijstellen en met één grote knop afvinken. Opmerking optioneel uitklapbaar.
 * Bij de huidige oefening toont de voet de volgende oefening.
 */
export function ExerciseCard({
  exercise,
  index,
  total,
  isCurrent,
  sets,
  note,
  nextExerciseName = null,
  onChangeSet,
  onToggleSet,
  onNoteChange,
  onNoteBlur,
  cardRef,
}: {
  exercise: ActiveExercise;
  index: number;
  total: number;
  isCurrent: boolean;
  sets: SetValue[];
  note: string;
  nextExerciseName?: string | null;
  onChangeSet: (setNumber: number, field: "reps" | "kg", value: string) => void;
  onToggleSet: (setNumber: number) => void;
  onNoteChange: (value: string) => void;
  onNoteBlur: () => void;
  cardRef: (el: HTMLElement | null) => void;
}) {
  const [showNote, setShowNote] = useState(Boolean(note));
  const doneCount = sets.filter((s) => s.done).length;
  const allDone = doneCount === exercise.sets;

  return (
    <m.section
      ref={cardRef}
      animate={{
        opacity: allDone && !isCurrent ? 0.6 : 1,
        scale: isCurrent ? 1 : 0.995,
      }}
      transition={{ duration: 0.25 }}
      className={cn(
        "scroll-mt-4 rounded-2xl border bg-surface-1 p-4 shadow-sm",
        isCurrent ? "border-accent ring-2 ring-accent/30" : "border-border"
      )}
    >
      <div className="flex items-start gap-3">
        {exercise.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exercise.thumbUrl}
            alt=""
            aria-hidden
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-neutral-400">
            🏋
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              {index + 1}/{total}
            </span>
            {isCurrent ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
                Bezig
              </span>
            ) : null}
            {allDone ? <span className="text-sm text-accent">✓ klaar</span> : null}
          </div>
          <h2 className="truncate font-display text-lg font-bold text-neutral-900">
            {exercise.name}
          </h2>
          <p className="text-xs text-neutral-500">
            doel: {exercise.sets} × {exercise.targetReps}
            {exercise.targetWeightKg ? ` · ${exercise.targetWeightKg} kg` : ""}
            {exercise.machineName ? ` · ${exercise.machineName}` : ""}
            {exercise.restSeconds ? ` · ${exercise.restSeconds}s rust` : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {sets.map((s, i) => {
          const setNumber = i + 1;
          return (
            <div
              key={setNumber}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors",
                s.done ? "border-accent/40 bg-accent-soft" : "border-border bg-surface-0"
              )}
            >
              <span className="w-9 shrink-0 text-center text-xs font-semibold text-neutral-500">
                {setNumber}
              </span>
              <Stepper
                value={s.kg}
                unit="kg"
                step={2.5}
                onChange={(v) => onChangeSet(setNumber, "kg", v)}
              />
              <Stepper
                value={s.reps}
                unit="reps"
                step={1}
                onChange={(v) => onChangeSet(setNumber, "reps", v)}
              />
              <button
                type="button"
                aria-label={
                  s.done ? `Set ${setNumber} ongedaan maken` : `Set ${setNumber} afvinken`
                }
                aria-pressed={s.done}
                onClick={() => onToggleSet(setNumber)}
                className={cn(
                  "ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-xl font-bold transition-colors active:scale-95",
                  s.done
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-neutral-300 text-neutral-300"
                )}
              >
                {s.saving ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  "✓"
                )}
              </button>
            </div>
          );
        })}
      </div>

      {showNote ? (
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          onBlur={onNoteBlur}
          rows={2}
          maxLength={500}
          placeholder="Opmerking (bijv. voelde zwaar, let op vorm)…"
          className="mt-3 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="mt-3 text-xs font-medium text-neutral-500 active:text-neutral-900"
        >
          ＋ Opmerking toevoegen
        </button>
      )}

      {isCurrent && nextExerciseName ? (
        <p className="mt-3 border-t border-border/60 pt-2 text-xs text-neutral-500">
          Volgende:{" "}
          <span className="font-medium text-neutral-700">{nextExerciseName}</span>
        </p>
      ) : null}
    </m.section>
  );
}
