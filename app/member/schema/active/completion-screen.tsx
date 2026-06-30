"use client";

import { m } from "motion/react";
import { useFormStatus } from "react-dom";
import { endSession } from "../actions";

function fmtDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m} min ${s}s` : `${s}s`;
}

function FinishButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-accent-gradient px-6 py-4 text-center text-lg font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? "Opslaan…" : "Workout afronden 🎉"}
    </button>
  );
}

/**
 * Voltooid-scherm met animatie en samenvatting. Verschijnt als alle sets klaar
 * zijn of wanneer het lid de workout afrondt. Afronden sluit de sessie af (en
 * navigeert naar de historie) via de bestaande `endSession`-action.
 */
export function CompletionScreen({
  sessionId,
  completedExercises,
  totalExercises,
  completedSets,
  totalVolume,
  durationSec,
  onContinue,
}: {
  sessionId: string;
  completedExercises: number;
  totalExercises: number;
  completedSets: number;
  totalVolume: number;
  durationSec: number;
  onContinue: () => void;
}) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-surface-0/95 px-6 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="Workout voltooid"
    >
      <m.div
        initial={{ y: 24, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm text-center"
      >
        <div className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center">
          <m.span
            className="absolute inset-0 rounded-full bg-accent-soft"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.15, 1], opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
          <m.span
            className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent-gradient text-4xl text-accent-foreground shadow-accent"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 18 }}
          >
            ✓
          </m.span>
        </div>

        <h1 className="font-display text-2xl font-bold text-neutral-900">
          Workout voltooid! 💪
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Sterk gedaan. Goed bezig.</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat value={`${completedExercises}/${totalExercises}`} label="oefeningen" />
          <Stat value={String(completedSets)} label="sets" />
          <Stat value={`${Math.round(totalVolume)} kg`} label="totaal volume" />
          <Stat value={fmtDuration(durationSec)} label="duur" />
        </div>

        <form action={endSession} className="mt-6">
          <input type="hidden" name="sessionId" value={sessionId} />
          <FinishButton />
        </form>
        <button
          type="button"
          onClick={onContinue}
          className="mt-3 w-full rounded-2xl border border-border px-6 py-3 text-center text-sm font-medium text-neutral-700 active:bg-surface-2"
        >
          Verder trainen
        </button>
      </m.div>
    </m.div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 px-3 py-4">
      <p className="font-display text-xl font-bold leading-none text-neutral-900">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-neutral-500">{label}</p>
    </div>
  );
}
