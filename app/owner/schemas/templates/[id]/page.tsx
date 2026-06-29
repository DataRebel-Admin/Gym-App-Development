import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { SchemaEditor, type EditorItem } from "@/components/schema-editor";
import { deleteTemplate } from "../../actions";

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await requireOwner();

  const template = await prisma.workoutTemplate.findFirst({
    where: { id, tenantId: owner.tenantId, isLibrary: true },
    include: {
      items: { orderBy: { order: "asc" }, include: { exercise: true } },
    },
  });
  if (!template) notFound();

  const exercises = await prisma.exercise.findMany({
    where: { tenantId: owner.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, targetMuscle: true },
  });

  const initialItems: EditorItem[] = template.items.map((it) => ({
    key: it.id,
    exerciseId: it.exerciseId,
    exerciseName: it.exercise.name,
    sets: it.sets,
    reps: it.reps,
    restSeconds: it.restSeconds,
    weightKg: it.weightKg,
    notes: it.notes ?? "",
  }));

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/owner/schemas/templates"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Templates
      </Link>

      <SchemaEditor
        templateId={template.id}
        initialName={template.name}
        initialDescription={template.description ?? ""}
        initialItems={initialItems}
        availableExercises={exercises}
      />

      <section className="flex max-w-3xl flex-col gap-3 rounded-xl border border-red-200 p-5">
        <h2 className="text-sm font-semibold text-red-700">Verwijderen</h2>
        <form action={deleteTemplate}>
          <input type="hidden" name="id" value={template.id} />
          <button
            type="submit"
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Template verwijderen
          </button>
        </form>
      </section>
    </div>
  );
}
