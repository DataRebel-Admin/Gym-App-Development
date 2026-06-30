import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/staff";
import { SchemaEditor, type EditorDay } from "@/components/schema-editor";
import { deleteTemplate, duplicateTemplate } from "../../actions";
import { SchemaAssignPanel } from "@/components/schema-assign-panel";
import { SchemaAssignmentOverview } from "@/components/schema-assignment-overview";
import { getAssignmentsForTemplate } from "@/lib/schema-assignments";
import { getDayTemplateOptions } from "@/lib/day-templates";
import { itemToInputValues } from "@/lib/exercise-params";
import { getMasterSuggestions } from "@/lib/coach-insights";
import { SchemaSuggestions } from "@/components/schema-suggestions";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const template = tenant
    ? await prisma.workoutTemplate.findFirst({
        where: { id, tenantId: tenant.id, isLibrary: true },
        select: { name: true },
      })
    : null;
  return { title: template ? `${template.name} | Sjabloon` : "Sjabloon" };
}

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await requirePermission("schemas:manage");

  const template = await prisma.workoutTemplate.findFirst({
    where: { id, tenantId: owner.tenantId, isLibrary: true },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: {
          items: { orderBy: { order: "asc" }, include: { exercise: true } },
        },
      },
    },
  });
  if (!template) notFound();

  const exerciseRows = await prisma.exercise.findMany({
    where: { tenantId: owner.tenantId, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, targetMuscle: true, catalogId: true, exerciseType: true },
  });
  const exercises = exerciseRows.map((e) => ({
    id: e.id,
    name: e.name,
    targetMuscle: e.targetMuscle,
    exerciseType: e.exerciseType,
    source: e.catalogId ? ("standaard" as const) : ("eigen" as const),
  }));

  const members = await prisma.user.findMany({
    where: { tenantId: owner.tenantId, role: "TENANT_MEMBER", archivedAt: null, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  const isSchema = template.kind === "SCHEMA";
  const assignments = isSchema
    ? await getAssignmentsForTemplate(owner.tenantId, template.id)
    : [];
  const dayTemplates = isSchema ? await getDayTemplateOptions(owner.tenantId) : [];
  const suggestions = isSchema ? await getMasterSuggestions(owner.tenantId, template.id) : [];

  const initialDays: EditorDay[] = template.days.map((d) => ({
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
      <div className="flex items-center gap-2">
        <Link
          href="/owner/schemas/templates"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Templates
        </Link>
        <Badge tone={isSchema ? "success" : "accent"}>
          {isSchema ? "Schema" : "Dag-template"}
        </Badge>
      </div>

      <SchemaEditor
        templateId={template.id}
        initialName={template.name}
        initialDescription={template.description ?? ""}
        initialCoachNote={template.coachNote ?? ""}
        initialDays={initialDays}
        availableExercises={exercises}
        dayTemplates={dayTemplates}
      />

      {isSchema ? (
        <>
          <SchemaSuggestions masterId={template.id} suggestions={suggestions} />

          <section className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-border p-5">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Toewijzen aan leden</h2>
              <p className="text-sm text-neutral-500">
                Zoek en selecteer leden, kies wanneer het schema beschikbaar wordt en voeg
                een persoonlijke boodschap toe. Leden krijgen automatisch een melding via
                hun voorkeurskanalen.
              </p>
            </div>
            <SchemaAssignPanel templateId={template.id} members={members} />
          </section>

          <section className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-border p-5">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Toewijzingen</h2>
              <p className="text-sm text-neutral-500">
                Wie heeft dit schema, met welke status en sinds wanneer.
              </p>
            </div>
            <SchemaAssignmentOverview rows={assignments} />
          </section>
        </>
      ) : null}

      <section className="flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-border p-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Dupliceren</h2>
          <p className="text-sm text-neutral-500">Maak een kopie van dit schema (incl. dagen).</p>
        </div>
        <form action={duplicateTemplate}>
          <input type="hidden" name="id" value={template.id} />
          <button type="submit" className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
            Dupliceren
          </button>
        </form>
      </section>

      <section className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-red-200 p-5">
        <h2 className="text-sm font-semibold text-red-700">Verwijderen</h2>
        <ConfirmButton
          action={deleteTemplate}
          fields={{ id: template.id }}
          label="Template verwijderen"
          triggerClassName="self-start rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          title="Template verwijderen?"
          message="Weet je zeker dat je deze template wilt verwijderen? Toegewezen lid-schema's blijven bestaan."
        />
      </section>
    </div>
  );
}
