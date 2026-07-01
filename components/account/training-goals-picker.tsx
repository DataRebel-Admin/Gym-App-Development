"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "@/components/ui/icons";
import { TRAINING_GOALS } from "@/lib/training-goals";
import { setTrainingGoals, type TrainingGoalsState } from "@/app/account/goals-actions";

/**
 * Doelkiezer voor de sporter: neutrale, motiverende doelen als toggle-kaarten.
 * Meerdere doelen mogen tegelijk aan staan. Eén flexibele ervaring — geen
 * aannames over geslacht, leeftijd of trainingsvorm.
 */
export function TrainingGoalsPicker({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));
  const [state, formAction, pending] = useActionState<TrainingGoalsState, FormData>(
    setTrainingGoals,
    {}
  );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {[...selected].map((key) => (
        <input key={key} type="hidden" name="goals" value={key} />
      ))}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.values(TRAINING_GOALS).map((g) => {
          const active = selected.has(g.key);
          const Icon = g.icon;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => toggle(g.key)}
              aria-pressed={active}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                active
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-surface-0 hover:border-border-strong"
              }`}
            >
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${g.tone}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium text-neutral-900">
                  {g.label}
                  {active ? <Check className="h-4 w-4 text-accent" aria-hidden /> : null}
                </span>
                <span className="mt-0.5 block text-sm text-neutral-500">{g.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Doelen opslaan
        </Button>
        {state.ok ? <span className="text-sm text-green-600">Opgeslagen ✓</span> : null}
        {state.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
