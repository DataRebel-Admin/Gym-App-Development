"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { getFavoriteIds, withFavoriteIds } from "@/lib/user-preferences";

const toggleSchema = z.object({ exerciseId: z.string().min(1) });

/**
 * Zet een oefening aan/uit als favoriet (User.preferences.favoriteExerciseIds).
 * Lichtgewicht (geen revalidate/redirect) — de bibliotheek roept dit optimistisch
 * aan. Valideert dat de oefening bij de tenant hoort. Retourneert de nieuwe staat.
 */
export async function toggleFavoriteExercise(
  input: z.infer<typeof toggleSchema>
): Promise<{ ok: boolean; favorite: boolean }> {
  const member = await requireMember();
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, favorite: false };
  const { exerciseId } = parsed.data;

  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, tenantId: member.tenantId },
    select: { id: true },
  });
  if (!exercise) return { ok: false, favorite: false };

  const user = await prisma.user.findUnique({
    where: { id: member.id },
    select: { preferences: true },
  });
  const current = new Set(getFavoriteIds(user?.preferences));
  const favorite = !current.has(exerciseId);
  if (favorite) current.add(exerciseId);
  else current.delete(exerciseId);

  await prisma.user.update({
    where: { id: member.id },
    data: { preferences: withFavoriteIds(user?.preferences, [...current]) },
  });
  return { ok: true, favorite };
}
