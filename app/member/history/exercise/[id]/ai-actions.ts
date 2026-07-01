"use server";

import { requireMember } from "@/lib/member";
import { runSurfaceAssistant, type AssistantResult } from "@/lib/ai";

/** Oefening-assistent voor de sporter (informatief). `exerciseId` wordt server-side gebonden. */
export async function askExerciseAssistant(
  exerciseId: string,
  question: string
): Promise<AssistantResult> {
  const member = await requireMember();
  return runSurfaceAssistant({
    surfaceId: "exercise",
    question,
    ref: exerciseId,
    user: { id: member.id, tenantId: member.tenantId, role: "member" },
  });
}
