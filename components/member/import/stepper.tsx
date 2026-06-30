"use client";

import { cn } from "@/lib/cn";

export type StepDef = { id: number; label: string };

/** Horizontale stappen-indicator voor de import-wizard. */
export function Stepper({ steps, current }: { steps: StepDef[]; current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((step, i) => {
        const state = step.id < current ? "done" : step.id === current ? "active" : "todo";
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2 last:flex-none">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                state === "done" && "border-accent bg-accent text-accent-foreground",
                state === "active" && "border-accent text-accent",
                state === "todo" && "border-border text-neutral-400"
              )}
            >
              {state === "done" ? "✓" : step.id}
            </div>
            <span
              className={cn(
                "hidden whitespace-nowrap text-sm font-medium md:block",
                state === "todo" ? "text-neutral-400" : "text-neutral-700"
              )}
            >
              {step.label}
            </span>
            {i < steps.length - 1 ? (
              <div
                className={cn(
                  "h-px flex-1 transition-colors",
                  step.id < current ? "bg-accent" : "bg-border"
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
