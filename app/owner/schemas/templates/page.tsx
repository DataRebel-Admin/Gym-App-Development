import Link from "next/link";
import type { WorkoutTemplate } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { createTemplate, duplicateTemplate } from "../actions";

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
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-500">
          <tr>
            <th className="px-4 py-2 font-medium">Naam</th>
            <th className="px-4 py-2 font-medium">Oefeningen</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t border-neutral-100">
              <td className="px-4 py-2 font-medium text-neutral-900">{t.name}</td>
              <td className="px-4 py-2 text-neutral-700">{t._count.items}</td>
              <td className="px-4 py-2">
                <div className="flex items-center justify-end gap-3">
                  <form action={duplicateTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="text-neutral-500 hover:text-neutral-900">
                      Dupliceren
                    </button>
                  </form>
                  <Link
                    href={`/owner/schemas/templates/${t.id}`}
                    className="text-accent hover:underline"
                  >
                    Bewerken
                  </Link>
                </div>
              </td>
            </tr>
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

export default async function TemplatesPage() {
  const owner = await requireOwner();

  const templates = await prisma.workoutTemplate.findMany({
    where: { tenantId: owner.tenantId, isLibrary: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  const schemas = templates.filter((t) => t.kind === "SCHEMA");
  const dayTemplates = templates.filter((t) => t.kind === "DAY");

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
    </div>
  );
}
