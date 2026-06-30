import "server-only";
import { prisma } from "@/lib/db";
import { itemToInputValues } from "@/lib/exercise-params";
import type { DayTemplateOption } from "@/components/schema-editor";

/**
 * Herbruikbare dag-templates (WorkoutTemplate kind=DAY) als invoeg-opties voor de
 * editor ("Dag toevoegen vanuit template"). Een DAY-template bevat precies één
 * WorkoutDay; we mappen die naar een EditorDay-achtige optie.
 */
export async function getDayTemplateOptions(tenantId: string): Promise<DayTemplateOption[]> {
  const rows = await prisma.workoutTemplate.findMany({
    where: { tenantId, isLibrary: true, kind: "DAY" },
    orderBy: { name: "asc" },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: {
          items: {
            orderBy: { order: "asc" },
            include: { exercise: { select: { name: true, exerciseType: true } } },
          },
        },
      },
    },
  });

  return rows.map((t) => {
    const day = t.days[0];
    return {
      id: t.id,
      name: t.name,
      notes: day?.notes ?? "",
      items: (day?.items ?? []).map((it) => ({
        exerciseId: it.exerciseId,
        exerciseName: it.exercise.name,
        exerciseType: it.exercise.exerciseType,
        values: itemToInputValues(it, it.exercise.exerciseType),
        notes: it.notes ?? "",
      })),
    };
  });
}
