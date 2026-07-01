import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { SchemaEditor, type EditorDay } from "@/components/schema-editor";
import { Badge } from "@/components/ui/badge";
import { itemToInputValues } from "@/lib/exercise-params";
import { getDayTemplateOptions } from "@/lib/day-templates";
import { MEMBER_STATUS_META } from "@/lib/member-schema-status";
import { REQUEST_GOAL_LABELS } from "@/lib/schema-requests";
import { fmtDate } from "@/lib/schema-status";
import { reviewMemberSchema } from "../../actions";

export const metadata = { title: "Zelf-schema beoordelen" };

export default async function MemberBuiltReviewDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await requirePermission("schemas:manage");

  const assignment = await prisma.assignedWorkout.findFirst({
    where: { id, tenantId: owner.tenantId, origin: "MEMBER" },
    include: {
      user: { select: { name: true, email: true } },
      template: {
        include: {
          days: {
            orderBy: { order: "asc" },
            include: { items: { orderBy: { order: "asc" }, include: { exercise: true } } },
          },
        },
      },
    },
  });
  if (!assignment?.template) notFound();

  const status = assignment.memberStatus ?? "DRAFT";
  const meta = MEMBER_STATUS_META[status];
  const canReview = status === "IN_REVIEW";

  const exerciseRows = await prisma.exercise.findMany({
    where: { tenantId: owner.tenantId, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      targetMuscle: true,
      catalogId: true,
      exerciseType: true,
      imageUrls: true,
      machine: { select: { name: true } },
      catalog: { select: { imageUrl: true, gifUrl: true } },
    },
  });
  const exercises = exerciseRows.map((e) => ({
    id: e.id,
    name: e.name,
    targetMuscle: e.targetMuscle,
    exerciseType: e.exerciseType,
    source: e.catalogId ? ("standaard" as const) : ("eigen" as const),
    thumbUrl: e.catalog?.imageUrl ?? e.catalog?.gifUrl ?? e.imageUrls[0] ?? null,
    machineName: e.machine?.name ?? null,
  }));
  const dayTemplates = await getDayTemplateOptions(owner.tenantId);

  const initialDays: EditorDay[] = assignment.template.days.map((d) => ({
    key: d.id,
    name: d.name,
    notes: d.notes ?? "",
    items: d.items.map((it) => ({
      key: it.id,
      exerciseId: it.exerciseId,
      exerciseName: it.exercise.name,
      exerciseType: it.exercise.exerciseType,
      values: itemToInputValues(it, it.exercise.exerciseType),
      notes: it.notes ?? "",
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/owner/schemas/member-built"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Zelf-schema&apos;s
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">
            {assignment.template.name}
          </h2>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Door {assignment.user.name ?? assignment.user.email}
          {assignment.goal ? ` · doel: ${REQUEST_GOAL_LABELS[assignment.goal]}` : ""}
          {assignment.submittedAt ? ` · ingediend ${fmtDate(assignment.submittedAt)}` : ""}
        </p>
        {assignment.focusNote ? (
          <p className="mt-1 text-sm italic text-neutral-500">
            &ldquo;{assignment.focusNote}&rdquo;
          </p>
        ) : null}
      </div>

      {canReview ? (
        <section className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-neutral-900">Beoordelen</h3>
          <p className="text-sm text-neutral-500">
            Pas het schema hieronder eventueel aan en keur het daarna goed of vraag om
            aanpassingen. Het lid krijgt automatisch een melding.
          </p>
          <form action={reviewMemberSchema} className="flex flex-col gap-3">
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <textarea
              name="reviewNote"
              rows={2}
              maxLength={1000}
              placeholder="Feedback voor het lid (verplicht bij afwijzen)…"
              className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                name="decision"
                value="approve"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
              >
                Goedkeuren
              </button>
              <button
                type="submit"
                name="decision"
                value="approve_activate"
                className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent-soft"
              >
                Goedkeuren &amp; activeren
              </button>
              <button
                type="submit"
                name="decision"
                value="reject"
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Aanpassingen vragen
              </button>
            </div>
          </form>
        </section>
      ) : assignment.reviewNote ? (
        <section className="max-w-3xl rounded-2xl border border-border bg-surface-1 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Jouw feedback
          </p>
          <p className="mt-1 text-sm text-neutral-700">{assignment.reviewNote}</p>
        </section>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-neutral-900">Schema bekijken / bewerken</h3>
        <SchemaEditor
          templateId={assignment.template.id}
          initialName={assignment.template.name}
          initialDescription={assignment.template.description ?? ""}
          initialCoachNote={assignment.template.coachNote ?? ""}
          initialValidityWeeks={assignment.template.validityWeeks}
          initialGoal={assignment.template.goal}
          initialBadges={assignment.template.badges}
          initialDays={initialDays}
          availableExercises={exercises}
          dayTemplates={dayTemplates}
        />
      </div>
    </div>
  );
}
