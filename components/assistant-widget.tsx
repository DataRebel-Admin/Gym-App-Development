"use client";

import { askAssistant } from "@/app/member/assistant-actions";
import { AssistantLauncher } from "@/components/ai/assistant-launcher";

/**
 * Sporter-assistent (chat-bubble op /member). Dunne wrapper rond de gedeelde
 * `AssistantLauncher`; de context zit in de "member-home"-surface achter `askAssistant`.
 */
export function AssistantWidget({ suggestions }: { suggestions?: string[] }) {
  return (
    <AssistantLauncher
      title="Trainingsassistent"
      ask={askAssistant}
      suggestions={suggestions}
      intro="Stel een vraag over je schema of de apparatuur."
    />
  );
}
