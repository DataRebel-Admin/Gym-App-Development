import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { SchemaEditor, type EditorItem } from "@/components/schema-editor";
import {
  assignFromTemplate,
  startEmptySchema,
  removeAssignment,
} from "../../actions";

export default async function MemberSchemaPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const owner = await requireOwner();

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId, role: "MEMBER" },
  });
  if (!member) notFound();

  const assignment = await prisma.assignedWorkout.findFirst({
    where: { tenantId: owner.tenantId, userId },
    include: {
      template: {
        include: {
          items: { orderBy: { order: "asc" }, include: { exercise: true } },
        },
      },
    },
  });

  const exercises = await prisma.exercise.findMany({
    where: { tenantId: owner.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, targetMuscle: true },
  });

  const libraryTemplates = await prisma.workoutTemplate.findMany({
    where: { tenantId: owner.tenantId, isLibrary: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const template = assignment?.template;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/owner/schemas/members"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Leden
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-neutral-900">
          {member.name ?? member.email}
        </h2>
      </div>

      {template ? (
        <>
          <SchemaEditor
            templateId={template.id}
            initialName={template.name}
            initialDescription={template.description ?? ""}
            initialItems={template.items.map<EditorItem>((it) => ({
              key: it.id,
              exerciseId: it.exerciseId,
              exerciseName: it.exercise.name,
              sets: it.sets,
              reps: it.reps,
              restSeconds: it.restSeconds,
            }))}
            availableExercises={exercises}
          />

          <section className="flex max-w-3xl items-center justify-between rounded-xl border border-neutral-200 p-4">
            <span className="text-sm text-neutral-500">
              Schema vervangen of verwijderen
            </span>
            <form action={removeAssignment}>
              <input type="hidden" name="userId" value={member.id} />
              <button
                type="submit"
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Schema verwijderen
              </button>
            </form>
          </section>
        </>
      ) : (
        <section className="flex max-w-2xl flex-col gap-5">
          <p className="text-sm text-neutral-500">
            Dit lid heeft nog geen schema. Kopieer een template of begin leeg.
          </p>

          <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4">
            <span className="text-sm font-medium text-neutral-700">
              Kopieer van een template
            </span>
            {libraryTemplates.length === 0 ? (
              <p className="text-sm text-neutral-400">
                Nog geen templates beschikbaar.
              </p>
            ) : (
              libraryTemplates.map((t) => (
                <form
                  key={t.id}
                  action={assignFromTemplate}
                  className="flex items-center justify-between"
                >
                  <input type="hidden" name="userId" value={member.id} />
                  <input type="hidden" name="sourceTemplateId" value={t.id} />
                  <span className="text-sm text-neutral-900">{t.name}</span>
                  <button
                    type="submit"
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
                  >
                    Kopieer &amp; wijs toe
                  </button>
                </form>
              ))
            )}
          </div>

          <form action={startEmptySchema}>
            <input type="hidden" name="userId" value={member.id} />
            <button
              type="submit"
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Begin met leeg schema
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
