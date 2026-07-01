"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/account";
import { parseTrainingGoals } from "@/lib/training-goals";

export type TrainingGoalsState = { ok?: boolean; error?: string };

/**
 * De sporter kiest zélf zijn/haar trainingsdoelen (neutrale lijst uit
 * lib/training-goals.ts). Meerdere doelen mogen; leeg = geen voorkeur. Wordt
 * gebruikt voor personalisatie (dashboard) en zichtbaar voor de coach.
 */
export async function setTrainingGoals(
  _prev: TrainingGoalsState,
  formData: FormData
): Promise<TrainingGoalsState> {
  const me = await requireAccount();
  const selected = parseTrainingGoals(formData.getAll("goals"));

  await prisma.user.update({
    where: { id: me.id },
    data: { trainingGoals: selected },
  });

  revalidatePath("/account/doelen");
  revalidatePath("/member");
  return { ok: true };
}
