import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/staff";
import { SchemaEditor, type EditorDay } from "@/components/schema-editor";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { SchemaDiffView } from "@/components/schema-compare";
import { SchemaSyncPanel } from "@/components/schema-sync-panel";
import {
  snapshotOf,
  asSnapshot,
  diffSnapshots,
  hasAnyDiff,
  type SchemaDiff,
} from "@/lib/schema-diff";
import { getAssignmentsForMember } from "@/lib/schema-assignments";
import { getDayTemplateOptions } from "@/lib/day-templates";
import { itemToInputValues } from "@/lib/exercise-params";
import { ASSIGNMENT_STATUS_META, fmtDate, fmtDateTime, isActiveNow } from "@/lib/schema-status";
import {
  assignFromTemplate,
  startEmptySchema,
  publishAssignment,
  archiveAssignment,
  removeAssignment,
} from "../../actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const tenant = await getCurrentTenant();
  const member = tenant
    ? await prisma.user.findFirst({
        where: { id: userId, tenantId: tenant.id, role: "TENANT_MEMBER" },
        select: { name: true, email: true },
      })
    : null;
  const label = member?.name ?? member?.email ?? "Lid";
  return { title: `${label} | Schema` };
}

export default async function MemberSchemaPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const owner = await requirePermission("schemas:manage");

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId, role: "TENANT_MEMBER" },
  });
  if (!member) notFound();

  const assignments = await getAssignmentsForMember(owner.tenantId, userId);
  const liveOrDraft = assignments.filter((a) => a.status !== "ARCHIVED");
  // Het te bewerken schema: het actieve gepubliceerde, anders het eerste concept/geplande.
  const primary =
    liveOrDraft.find((a) => isActiveNow(a)) ?? liveOrDraft[0] ?? null;

  const primaryTemplate = primary?.template
    ? await prisma.workoutTemplate.findFirst({
        where: { id: primary.template.id, tenantId: owner.tenantId },
        include: {
          days: {
            orderBy: { order: "asc" },
            include: {
              items: { orderBy: { order: "asc" }, include: { exercise: true } },
            },
          },
        },
      })
    : null;

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

  // Naam-map (incl. gearchiveerde) voor de diff-weergaven.
  const allExercises = await prisma.exercise.findMany({
    where: { tenantId: owner.tenantId },
    select: { id: true, name: true },
  });
  const exerciseNames: Record<string, string> = Object.fromEntries(
    allExercises.map((e) => [e.id, e.name])
  );

  // Master ↔ persoonlijke kopie: persoonlijke aanpassingen + sync-status.
  let personalDiff: SchemaDiff | null = null;
  let masterDiff: SchemaDiff | null = null;
  let fullDiff: SchemaDiff | null = null;
  let personalized = false;
  let syncAvailable = false;
  if (primary && primaryTemplate) {
    const full = await prisma.assignedWorkout.findUnique({
      where: { id: primary.id },
      select: { baselineSnapshot: true, masterSyncedAt: true, sourceTemplateId: true },
    });
    const baseline = asSnapshot(full?.baselineSnapshot);
    const personalSnap = snapshotOf(primaryTemplate);
    if (baseline) {
      personalDiff = diffSnapshots(baseline, personalSnap);
      personalized = hasAnyDiff(personalDiff);
    }
    if (full?.sourceTemplateId) {
      const master = await prisma.workoutTemplate.findFirst({
        where: { id: full.sourceTemplateId, tenantId: owner.tenantId },
        include: {
          days: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
        },
      });
      if (master && baseline) {
        const masterSnap = snapshotOf(master);
        masterDiff = diffSnapshots(baseline, masterSnap);
        fullDiff = diffSnapshots(personalSnap, masterSnap);
        const masterChangedSince = full.masterSyncedAt
          ? master.updatedAt.getTime() > full.masterSyncedAt.getTime()
          : false;
        syncAvailable = masterChangedSince && hasAnyDiff(masterDiff);
      }
    }
  }

  const libraryTemplates = await prisma.workoutTemplate.findMany({
    where: { tenantId: owner.tenantId, isLibrary: true, kind: "SCHEMA" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const dayTemplates = await getDayTemplateOptions(owner.tenantId);

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

      {/* Overzicht van toewijzingen (status + acties) */}
      {liveOrDraft.length > 0 ? (
        <section className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-neutral-900">Toewijzingen</h3>
          <ul className="flex flex-col gap-2">
            {liveOrDraft.map((a) => {
              const meta = ASSIGNMENT_STATUS_META[a.status];
              const active = isActiveNow(a);
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border px-3 py-2.5"
                >
                  <span className="font-medium text-neutral-900">
                    {a.template?.name ?? "Schema"}
                  </span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  {active ? <Badge tone="accent">Actief</Badge> : null}
                  {a.id === primary?.id && personalized ? (
                    <Badge tone="warning">Aangepast</Badge>
                  ) : null}
                  {a.id === primary?.id && syncAvailable ? (
                    <Badge tone="accent">Sync beschikbaar</Badge>
                  ) : null}
                  {a.status === "PUBLISHED" && !a.seenAt ? (
                    <Badge tone="warning">Nog niet geopend</Badge>
                  ) : null}
                  <span className="text-xs text-neutral-500">
                    {a.status === "SCHEDULED"
                      ? `vanaf ${fmtDateTime(a.availableFrom)}`
                      : a.status === "PUBLISHED"
                        ? `gepubliceerd ${fmtDate(a.publishedAt)}`
                        : "concept"}
                    {a.endDate ? ` · t/m ${fmtDate(a.endDate)}` : ""}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {a.status !== "PUBLISHED" ? (
                      <form action={publishAssignment}>
                        <input type="hidden" name="userId" value={userId} />
                        <input type="hidden" name="assignmentId" value={a.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
                        >
                          Publiceren
                        </button>
                      </form>
                    ) : null}
                    <form action={archiveAssignment}>
                      <input type="hidden" name="userId" value={userId} />
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                      >
                        Archiveren
                      </button>
                    </form>
                    <ConfirmButton
                      action={removeAssignment}
                      fields={{ userId, assignmentId: a.id }}
                      label="Verwijderen"
                      triggerClassName="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      title="Toewijzing verwijderen?"
                      message="Dit verwijdert het schema definitief voor dit lid."
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Slimme synchronisatie: master is gewijzigd sinds toewijzing */}
      {primary && syncAvailable && masterDiff && fullDiff ? (
        <SchemaSyncPanel
          userId={userId}
          assignmentId={primary.id}
          masterDiff={masterDiff}
          fullDiff={fullDiff}
          names={exerciseNames}
        />
      ) : null}

      {/* Persoonlijke aanpassingen t.o.v. de master (drift) */}
      {personalized && personalDiff ? (
        <section className="flex max-w-3xl flex-col gap-2 rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-neutral-900">
            Persoonlijke aanpassingen
          </h3>
          <p className="text-sm text-neutral-500">
            Dit schema wijkt af van de master-template. De master blijft ongewijzigd.
          </p>
          <SchemaDiffView diff={personalDiff} names={exerciseNames} />
        </section>
      ) : null}

      {/* Editor voor het primaire schema */}
      {primaryTemplate ? (
        <>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">
              {primary && isActiveNow(primary) ? "Actief schema bewerken" : "Schema bewerken"}
            </h3>
            <SchemaEditor
              templateId={primaryTemplate.id}
              initialName={primaryTemplate.name}
              initialDescription={primaryTemplate.description ?? ""}
              initialCoachNote={primaryTemplate.coachNote ?? ""}
              initialDays={primaryTemplate.days.map<EditorDay>((d) => ({
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
              }))}
              availableExercises={exercises}
              dayTemplates={dayTemplates}
            />
          </div>

          <section className="max-w-3xl rounded-xl border border-border p-4">
            <a
              href={`/owner/schemas/members/${member.id}/pdf`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              ⬇ Exporteer als PDF
            </a>
          </section>
        </>
      ) : null}

      {/* Nieuw schema voor dit lid */}
      <section className="flex max-w-2xl flex-col gap-5 rounded-2xl border border-border p-5">
        <h3 className="text-sm font-semibold text-neutral-900">Nieuw schema voor dit lid</h3>

        <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <span className="text-sm font-medium text-neutral-700">Kopieer van een template</span>
          {libraryTemplates.length === 0 ? (
            <p className="text-sm text-neutral-400">Nog geen templates beschikbaar.</p>
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
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
                >
                  Kopieer &amp; publiceer
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
    </div>
  );
}
