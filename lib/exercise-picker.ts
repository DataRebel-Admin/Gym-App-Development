import "server-only";
import { prisma } from "@/lib/db";
import { exerciseSourceOf, type ExerciseSource } from "@/lib/exercise-library/source";
import { exerciseThumbUrl, EXERCISE_THUMB_SELECT } from "@/lib/exercise-thumb";

/**
 * Eén canonieke query + mapping voor "alle beschikbare oefeningen van de tenant"
 * in schema-pickers (owner-SchemaEditor op 3 pagina's + de mobiele lid-builder).
 * Herkomst (standaard/klassiek/eigen) en thumbnail worden bron-bewust afgeleid:
 * bibliotheek-media wint, dan klassieke catalogus, dan eigen uploads.
 */
export type PickerExercise = {
  id: string;
  name: string;
  targetMuscle: string | null;
  exerciseType: string;
  source: ExerciseSource;
  thumbUrl: string | null;
  machineName: string | null;
};

export async function getPickerExercises(tenantId: string): Promise<PickerExercise[]> {
  const rows = await prisma.exercise.findMany({
    where: { tenantId, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      targetMuscle: true,
      catalogId: true,
      libraryId: true,
      exerciseType: true,
      machine: { select: { name: true } },
      ...EXERCISE_THUMB_SELECT,
    },
  });
  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    targetMuscle: e.targetMuscle,
    exerciseType: e.exerciseType,
    source: exerciseSourceOf(e),
    thumbUrl: exerciseThumbUrl(e),
    machineName: e.machine?.name ?? null,
  }));
}
