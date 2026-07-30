import Link from "next/link";
import type { WorkoutTemplate } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import {
  pickJsonName,
  LIBRARY_DIFFICULTY_LABEL,
  LIBRARY_GOAL_LABEL,
} from "@/lib/exercise-library/mapping";
import { Badge } from "@/components/ui/badge";
import { createTemplate, importLibraryTemplate } from "../actions";
import { TemplateRow } from "./template-row";

export const metadata = { title: "Schemasjablonen" };

type TemplateRow = WorkoutTemplate & { _count: { items: number } };

function TemplateTable({
  rows,
  emptyLabel,
}: {
  rows: TemplateRow[];
  emptyLabel: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full min-w-[24rem] text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-500">
          <tr>
            <th className="px-4 py-2 font-medium">Naam</th>
            <th className="px-4 py-2 font-medium">Oefeningen</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <TemplateRow key={t.id} template={t} />
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-neutral-500">
                {emptyLabel}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** Shape van één dag in `LibraryWorkoutTemplate.days` (alleen voor telwerk). */
type LibraryDaysJson = { exercises?: unknown[] }[] | null;

export default async function TemplatesPage() {
  const owner = await requirePermission("schemas:manage");

  const [templates, libraryTemplates] = await Promise.all([
    prisma.workoutTemplate.findMany({
      where: { tenantId: owner.tenantId, isLibrary: true },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
    prisma.libraryWorkoutTemplate.findMany({
      where: { retiredAt: null },
      orderBy: { id: "asc" },
    }),
  ]);

  const schemas = templates.filter((t) => t.kind === "SCHEMA");
  const dayTemplates = templates.filter((t) => t.kind === "DAY");
  // Reeds overgenomen voorbeeldschema's → "Toegevoegd"-status + open-link.
  const importedBySource = new Map(
    templates
      .filter((t) => t.libraryTemplateId)
      .map((t) => [t.libraryTemplateId as string, t.id])
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            Schema&apos;s ({schemas.length})
          </h2>
          <form action={createTemplate}>
            <input type="hidden" name="kind" value="SCHEMA" />
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Nieuw schema
            </button>
          </form>
        </div>
        <TemplateTable rows={schemas} emptyLabel="Nog geen schema's." />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Dag-templates ({dayTemplates.length})
            </h2>
            <p className="text-sm text-neutral-500">
              Herbruikbare trainingsdagen (Push/Pull/Legs…) om als blok in een schema
              te plakken.
            </p>
          </div>
          <form action={createTemplate}>
            <input type="hidden" name="kind" value="DAY" />
            <button
              type="submit"
              className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Nieuwe dag-template
            </button>
          </form>
        </div>
        <TemplateTable rows={dayTemplates} emptyLabel="Nog geen dag-templates." />
      </section>

      {/* Voorbeeldschema's uit de oefeningen-bibliotheek (RepDB) */}
      {libraryTemplates.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Voorbeeldschema&apos;s uit de bibliotheek ({libraryTemplates.length})
            </h2>
            <p className="text-sm text-neutral-500">
              Kant-en-klare startpunten (StrongLifts, PPL, full-body…). Overnemen
              maakt een eigen kopie die je vrij kunt bewerken; ontbrekende
              oefeningen worden automatisch aan je sportschool toegevoegd.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {libraryTemplates.map((t) => {
              const name = pickJsonName(t.names, ["nl", "en"]) ?? t.id;
              const description = pickJsonName(t.descriptions, ["nl", "en"]);
              const days = (t.days as LibraryDaysJson) ?? [];
              const exerciseCount = days.reduce(
                (sum, d) => sum + (d.exercises?.length ?? 0),
                0
              );
              const importedId = importedBySource.get(t.id);
              return (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-neutral-900">{name}</h3>
                      {importedId ? <Badge tone="success">Toegevoegd</Badge> : null}
                    </div>
                    {description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                        {description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Badge tone="neutral">
                      {LIBRARY_GOAL_LABEL[t.goal] ?? t.goal}
                    </Badge>
                    <Badge tone="neutral">
                      {LIBRARY_DIFFICULTY_LABEL[t.difficulty] ?? t.difficulty}
                    </Badge>
                    {t.frequencyPerWeek ? (
                      <Badge tone="neutral">{t.frequencyPerWeek}×/week</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-neutral-400">
                    {days.length} {days.length === 1 ? "dag" : "dagen"} ·{" "}
                    {exerciseCount} oefeningen
                  </p>
                  <div className="mt-auto">
                    {importedId ? (
                      <Link
                        href={`/owner/schemas/templates/${importedId}`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        Openen →
                      </Link>
                    ) : (
                      <form action={importLibraryTemplate}>
                        <input type="hidden" name="libraryTemplateId" value={t.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                        >
                          Kopieer naar mijn schema&apos;s
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
