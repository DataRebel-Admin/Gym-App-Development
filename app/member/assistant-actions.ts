"use server";

import { requireMember } from "@/lib/member";
import { runSurfaceAssistant, type AssistantResult } from "@/lib/ai";

/**
 * Sporter-assistent (chat-bubble op /member). Dunne wrapper: authenticeert het lid en
 * delegeert naar de gedeelde orchestrator (`runSurfaceAssistant`) op het "member-home"-
 * oppervlak. Gate (aiEnabled), rate-limit en safety-guardrail zitten in de orchestrator.
 */
export async function askAssistant(question: string): Promise<AssistantResult> {
  const member = await requireMember();
  return runSurfaceAssistant({
    surfaceId: "member-home",
    question,
    user: { id: member.id, tenantId: member.tenantId, role: "member" },
  });
}
