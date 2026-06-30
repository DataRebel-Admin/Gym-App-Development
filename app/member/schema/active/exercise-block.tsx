"use client";

import { useState } from "react";
import Link from "next/link";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { Dumbbell, Trophy, Plus, Minus, RotateCcw, ChevronRight } from "@/components/ui/icons";
import type { ActiveExercise, SetValue } from "./active-session";

const dateFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });

/** Compacte weergave "100 kg × 10". Bodyweight (0 kg) toont alleen reps. */
function fmtSet(s: { reps: number; weightKg: number }): string {
  return s.weightKg > 0 ? `${s.weightKg} kg × ${s.reps}` : `${s.reps}×`;
}

/** Grote, zweethanden-proof stepper voor gewicht/herhalingen tijdens de workout. */
function BigStepper({
  value,
  unit,
  step,
  placeholder,
  onChange,
}: {
  value: string;
  unit: string;
  step: number;
  placeholder?: string;
  onChange: (next: string) => void;
}) {
  function bump(delta: number) {
    const cur = Number(value || placeholder || 0);
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
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 rounded-xl border border-border bg-surface-0 px-1 py-2 text-center font-display text-xl font-bold leading-none tabular-nums text-neutral-900 outline-none placeholder:font-bold placeholder:text-neutral-300 focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
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
 * Eén oefening als kaart in de doorlopende workout-lijst: hero-kop, "vorige
 * keer"-regel, de sets onder elkaar (grote steppers), een knop om een extra set
 * toe te voegen en een opmerkingveld. Toont een live PR-badge zodra een
 * afgevinkte set de historische beste 1RM overtreft.
 */
export function ExerciseBlock({
  exercise,
  sets,
  note,
  historicalBestOneRm,
  onChangeSet,
  onToggleSet,
  onAddSet,
  onRemoveSet,
  onNoteChange,
  onNoteBlur,
}: {
  exercise: ActiveExercise;
  sets: SetValue[];
  note: string;
  historicalBestOneRm: number;
  onChangeSet: (setNumber: number, field: "reps" | "kg", value: string) => void;
  onToggleSet: (setNumber: number) => void;
  onAddSet: () => void;
  onRemoveSet: (setNumber: number) => void;
  onNoteChange: (value: string) => void;
  onNoteBlur: () => void;
}) {
  const [showNote, setShowNote] = useState(Boolean(note));
  const doneCount = sets.filter((s) => s.done).length;
  const allDone = doneCount === sets.length;

  // Live PR: beste geschatte 1RM van de afgevinkte sets vs. historische beste.
  const liveBest = sets.reduce((best, s) => {
    if (!s.done) return best;
    const kg = Number(s.kg || 0);
    const reps = Number(s.reps || 0);
    if (kg <= 0) return best;
    return Math.max(best, kg * (1 + reps / 30));
  }, 0);
  const isPr = liveBest > 0 && historicalBestOneRm > 0 && liveBest > historicalBestOneRm;

  const prevByNumber = new Map(exercise.previous?.sets.map((s) => [s.setNumber, s]) ?? []);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-surface-1 p-4 transition-colors",
        allDone ? "border-accent/40" : "border-border"
      )}
    >
      {/* Kop — tik om de oefening-uitleg te openen */}
      <Link
        href={`/member/history/exercise/${exercise.exerciseId}`}
        className="flex items-start gap-3 rounded-xl transition-opacity active:opacity-70"
        aria-label={`Bekijk uitleg van ${exercise.name}`}
      >
        {exercise.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exercise.thumbUrl}
            alt=""
            aria-hidden
            className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-sm"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Dumbbell className="size-7" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-500">
              {doneCount}/{sets.length} sets
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
          <h2 className="mt-1 font-display text-lg font-bold leading-tight text-neutral-900">
            {exercise.name}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            doel: {exercise.sets} × {exercise.targetReps}
            {exercise.targetWeightKg ? ` · ${exercise.targetWeightKg} kg` : ""}
            {exercise.machineName ? ` · ${exercise.machineName}` : ""}
          </p>
        </div>
        <span className="mt-0.5 flex shrink-0 items-center gap-0.5 text-xs font-medium text-neutral-400">
          uitleg
          <ChevronRight className="size-4" />
        </span>
      </Link>

      {/* Vorige keer */}
      {exercise.previous && exercise.previous.sets.length > 0 ? (
        <div className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2">
          <RotateCcw className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
          <p className="text-xs text-neutral-600">
            <span className="font-semibold text-neutral-700">
              Vorige keer ({dateFmt.format(new Date(exercise.previous.date))})
            </span>
            <span className="text-neutral-400"> · </span>
            {exercise.previous.sets.map((s) => fmtSet(s)).join(" · ")}
          </p>
        </div>
      ) : null}

      {/* Sets */}
      <div className="flex flex-col gap-2.5">
        {sets.map((s, i) => {
          const setNumber = i + 1;
          const prev = prevByNumber.get(setNumber);
          // Alleen de laatste, toegevoegde én nog niet afgevinkte set is te
          // verwijderen — zo verschuiven set-nummers van opgeslagen sets nooit.
          const removable = setNumber === sets.length && setNumber > exercise.sets && !s.done;
          return (
            <m.div
              key={setNumber}
              animate={{ opacity: s.done ? 1 : 0.92 }}
              className={cn(
                "relative rounded-2xl border p-3 transition-colors",
                s.done ? "border-accent/40 bg-accent-soft" : "border-border bg-surface-1"
              )}
            >
              {removable ? (
                <button
                  type="button"
                  aria-label={`Set ${setNumber} verwijderen`}
                  onClick={() => onRemoveSet(setNumber)}
                  className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-1 text-neutral-500 shadow-sm active:scale-90"
                >
                  <Minus className="size-3.5" />
                </button>
              ) : null}
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-sm font-bold text-neutral-600">
                  {setNumber}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <BigStepper
                    value={s.kg}
                    unit="kg"
                    step={2.5}
                    placeholder={prev && prev.weightKg > 0 ? String(prev.weightKg) : undefined}
                    onChange={(v) => onChangeSet(setNumber, "kg", v)}
                  />
                  <BigStepper
                    value={s.reps}
                    unit="reps"
                    step={1}
                    placeholder={prev ? String(prev.reps) : undefined}
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

      {/* Extra set toevoegen */}
      {sets.length < 20 ? (
        <button
          type="button"
          onClick={onAddSet}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border-strong py-2.5 text-sm font-semibold text-neutral-600 active:scale-[0.99]"
        >
          <Plus className="size-4" /> Set toevoegen
        </button>
      ) : null}

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
    </div>
  );
}
