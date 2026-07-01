"use client";

import { Sparkles } from "@/components/ui/icons";
import { AssistantPanel } from "@/components/ai/assistant-panel";
import type { AssistantResult, AssistantProposal } from "@/lib/ai/types";
import type { ApplyProposalResult } from "@/app/owner/members/[userId]/ai-actions";

/**
 * AI Coach-kaart op het ledenprofiel. Ontvangt reeds-gebonden server-actions (per lid)
 * en deelt dezelfde `AssistantPanel` als de member-bubble. `onApply` ontbreekt wanneer de
 * medewerker geen coachnotities mag beheren → dan alleen tekstadvies, geen "Toepassen".
 */
export function MemberProfileAssistant({
  ask,
  onApply,
  suggestions,
}: {
  ask: (question: string) => Promise<AssistantResult>;
  onApply?: (proposal: AssistantProposal) => Promise<ApplyProposalResult>;
  suggestions: string[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface-1">
      <div className="border-b border-border px-5 py-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <Sparkles className="size-4 text-accent" /> AI Coach
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Vat de voortgang samen en krijg suggesties. Geen medisch advies; wijzigingen
          gebeuren pas na jouw bevestiging.
        </p>
      </div>
      <AssistantPanel
        ask={ask}
        onApply={onApply}
        suggestions={suggestions}
        height="tall"
        intro="Kies een suggestie of stel je eigen vraag over dit lid."
        placeholder="Vraag iets over dit lid…"
      />
    </section>
  );
}
