"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Timer } from "@/components/ui/icons";
import { setSetTimerPreference } from "@/app/account/actions";

/**
 * Globale voorkeur: rust-/set-timers standaard uitzetten. Nieuwe trainingen
 * starten dan zonder automatische timers. Tijdens een actieve sessie kun je het
 * alsnog per training aan-/uitzetten (dat overschrijft deze standaard tijdelijk).
 */
export function TimerPreferenceToggle({ initialDisabled }: { initialDisabled: boolean }) {
  const [disabled, setDisabled] = useState(initialDisabled);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !disabled;
    setDisabled(next);
    const fd = new FormData();
    fd.set("disable", String(next));
    startTransition(() => {
      void setSetTimerPreference(fd);
    });
  }

  // De switch toont "timers aan" als de aangevinkte stand → aria-checked = !disabled.
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-1 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Timer className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-900">Rusttimers gebruiken</p>
          <p className="mt-0.5 text-sm text-neutral-500">
            Start automatisch een rusttimer na elke set. Zet je dit uit, dan starten
            nieuwe trainingen zonder timers — je kunt het per training alsnog aanzetten.
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!disabled}
        aria-label="Rusttimers gebruiken"
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-ring",
          disabled ? "bg-neutral-300" : "bg-accent"
        )}
      >
        <span
          className={cn(
            "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
            disabled ? "translate-x-0.5" : "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}
