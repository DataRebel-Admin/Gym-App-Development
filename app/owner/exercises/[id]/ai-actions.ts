"use server";

import { requireTenantUser } from "@/lib/staff";
import { runSurfaceAssistant, type AssistantResult } from "@/lib/ai";

/** Oefening-assistent voor coaches (owner/medewerker). `exerciseId` wordt server-side gebonden. */
export async function askExerciseAssistant(
  exerciseId: string,
  question: string
): Promise<AssistantResult> {
  const user = await requireTenantUser();
  return runSurfaceAssistant({
    surfaceId: "exercise",
    question,
    ref: exerciseId,
    user: { id: user.id, tenantId: user.tenantId, role: "coach" },
  });
}
