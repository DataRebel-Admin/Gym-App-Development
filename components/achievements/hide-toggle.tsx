"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Trophy } from "@/components/ui/icons";
import { setAchievementVisibility } from "@/app/account/actions";

/**
 * Persoonlijke opt-out: verberg trofeeën/mijlpalen uit het dashboard en de
 * navigatie. De sportschool bepaalt of de functie beschikbaar is; dit is de
 * individuele voorkeur van het lid.
 */
export function AchievementHideToggle({ initialHidden }: { initialHidden: boolean }) {
  const [hidden, setHidden] = useState(initialHidden);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !hidden;
    setHidden(next);
    const fd = new FormData();
    fd.set("hidden", String(next));
    startTransition(() => {
      void setAchievementVisibility(fd);
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-1 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Trophy className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-900">Trofeeën tonen</p>
          <p className="mt-0.5 text-sm text-neutral-500">
            Toon je trofeeën, mijlpalen en Gym Passport in de app.
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!hidden}
        aria-label="Trofeeën tonen"
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-ring",
          hidden ? "bg-neutral-300" : "bg-accent"
        )}
      >
        <span
          className={cn(
            "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
            hidden ? "translate-x-0.5" : "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}
