"use client";

import { Sparkles } from "@/components/ui/icons";
import { AssistantPanel } from "./assistant-panel";
import type { AssistantResult } from "@/lib/ai/types";

/**
 * Contextbewuste AI-assistent op de oefening-detailpagina (member én owner). Informatief:
 * uitleg, alternatieven en techniek. `ask` is een reeds-gebonden server-action (met het
 * exercise-id + rol). Geen `onApply` — dit oppervlak wijzigt geen data.
 */
export function ExerciseAssistant({
  ask,
  suggestions,
}: {
  ask: (question: string) => Promise<AssistantResult>;
  suggestions: string[];
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-surface-1">
      <div className="border-b border-border px-5 py-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <Sparkles className="size-4 text-accent" /> Vraag de AI-assistent
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Uitleg, alternatieven en techniek — geen medisch advies.
        </p>
      </div>
      <AssistantPanel
        ask={ask}
        suggestions={suggestions}
        intro="Stel een vraag over deze oefening."
        placeholder="Vraag iets over deze oefening…"
      />
    </section>
  );
}
