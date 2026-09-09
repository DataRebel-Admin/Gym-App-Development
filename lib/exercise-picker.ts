import "server-only";
import { prisma } from "@/lib/db";
import { exerciseSourceOf, type ExerciseSource } from "@/lib/exercise-library/source";
import { exerciseThumbUrl } from "@/lib/exercise-thumb";

/**
 * Eén canonieke query + mapping voor "alle beschikbare oefeningen van de tenant"
 * in schema-pickers (owner-SchemaEditor op 3 pagina's + de mobiele lid-builder).
 * Herkomst (standaard/klassiek/eigen) en thumbnail worden bron-bewust afgeleid:
 * bibliotheek-media wint, dan klassieke catalogus, dan eigen uploads.
 *
 * De spier-/materiaal-context (`muscles`/`secondaryMuscles`/`bodyPart`/
 * `equipment`) is er voor de client-side alternatieven-suggesties
 * (lib/exercise-suggestions.ts): beide editors hebben de volledige lijst al in
 * het geheugen, dus suggesties kosten geen extra server-roundtrip. Bron-bewust
 * gevuld (bibliotheek → klassiek → eigen), zelfde regel als de thumbnail.
 */
export type PickerExercise = {
  id: string;
  name: string;
  targetMuscle: string | null;
  exerciseType: string;
  source: ExerciseSource;
  thumbUrl: string | null;
  machineName: string | null;
  /** Primaire spier-labels/slugs (rauw — resolven via `resolveRegion`). */
  muscles: string[];
  /** Secundaire spier-labels/slugs (rauw). */
  secondaryMuscles: string[];
  bodyPart: string | null;
  equipment: string | null;
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
      muscleGroups: true,
      equipment: true,
      imageUrls: true,
      machine: { select: { name: true } },
      // Rijkere selectie dan EXERCISE_THUMB_RELATIONS (superset — de thumbnail
      // blijft werken), plus de matching-velden voor de suggesties.
      catalog: {
        select: {
          imageUrl: true,
          gifUrl: true,
          target: true,
          bodyPart: true,
          equipment: true,
          muscleGroup: true,
          secondaryMuscles: true,
        },
      },
      library: {
        select: {
          id: true,
          imageAlias: true,
          images: true,
          primaryMuscles: true,
          secondaryMuscles: true,
          bodyPart: true,
          equipmentSlug: true,
        },
      },
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
    // Bron-bewust: bibliotheek-slugs zijn de gecureerde data (vaak meerdere
    // primaire spieren); klassiek heeft target/muscleGroup; eigen oefeningen
    // dragen targetMuscle/muscleGroups zelf.
    muscles: e.library
      ? e.library.primaryMuscles
      : e.catalog
        ? [e.catalog.target, e.catalog.muscleGroup].filter((m): m is string => Boolean(m))
        : [e.targetMuscle, ...e.muscleGroups].filter((m): m is string => Boolean(m)),
    secondaryMuscles: e.library
      ? e.library.secondaryMuscles
      : (e.catalog?.secondaryMuscles ?? []),
    bodyPart: e.library?.bodyPart ?? e.catalog?.bodyPart ?? null,
    equipment: e.library?.equipmentSlug ?? e.catalog?.equipment ?? e.equipment ?? null,
  }));
}
