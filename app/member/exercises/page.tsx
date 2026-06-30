import { requireMember } from "@/lib/member";
import { prisma } from "@/lib/db";
import { ExerciseLibrary, type LibraryExercise } from "./exercise-library";

export const metadata = { title: "Oefeningen" };

export default async function MemberExercisesPage() {
  const member = await requireMember();

  const rows = await prisma.exercise.findMany({
    where: { tenantId: member.tenantId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      targetMuscle: true,
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
  });

  const exercises: LibraryExercise[] = rows.map((e) => ({
    id: e.id,
    name: e.name,
    thumbUrl: e.catalog?.imageUrl ?? e.catalog?.gifUrl ?? null,
    muscle: e.targetMuscle ?? e.catalog?.target ?? null,
    bodyPart: e.catalog?.bodyPart ?? null,
    equipment: e.catalog?.equipment ?? null,
  }));

  return <ExerciseLibrary exercises={exercises} />;
}
