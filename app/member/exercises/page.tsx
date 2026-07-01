import { requireMember } from "@/lib/member";
import { prisma } from "@/lib/db";
import { getFavoriteIds } from "@/lib/user-preferences";
import { ExerciseLibrary, type LibraryExercise } from "./exercise-library";

export const metadata = { title: "Oefeningen" };

export default async function MemberExercisesPage() {
  const member = await requireMember();

  const [rows, userRow] = await Promise.all([
    prisma.exercise.findMany({
      where: { tenantId: member.tenantId, archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        targetMuscle: true,
        equipment: true,
        imageUrls: true,
        catalog: {
          select: {
            imageUrl: true,
            gifUrl: true,
            bodyPart: true,
            equipment: true,
            target: true,
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: member.id }, select: { preferences: true } }),
  ]);
  const favorites = getFavoriteIds(userRow?.preferences);

  const exercises: LibraryExercise[] = rows.map((e) => ({
    id: e.id,
    name: e.name,
    thumbUrl: e.catalog?.imageUrl ?? e.catalog?.gifUrl ?? e.imageUrls[0] ?? null,
    muscle: e.targetMuscle ?? e.catalog?.target ?? null,
    bodyPart: e.catalog?.bodyPart ?? null,
    equipment: e.equipment ?? e.catalog?.equipment ?? null,
  }));

  return <ExerciseLibrary exercises={exercises} initialFavorites={favorites} />;
}
