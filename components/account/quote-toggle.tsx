"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Sparkles } from "@/components/ui/icons";
import { setQuoteVisibility } from "@/app/account/actions";

/**
 * Persoonlijke opt-out: verberg de motiverende Workout Quotes op het afrondscherm.
 * De sportschool bepaalt of de functie beschikbaar is; dit is de voorkeur van het lid.
 */
export function QuoteHideToggle({ initialHidden }: { initialHidden: boolean }) {
  const [hidden, setHidden] = useState(initialHidden);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !hidden;
    setHidden(next);
    const fd = new FormData();
    fd.set("hidden", String(next));
    startTransition(() => {
      void setQuoteVisibility(fd);
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-1 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Sparkles className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-900">Motiverende quotes tonen</p>
          <p className="mt-0.5 text-sm text-neutral-500">
            Toon een korte motiverende quote na een afgeronde training.
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!hidden}
        aria-label="Motiverende quotes tonen"
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
