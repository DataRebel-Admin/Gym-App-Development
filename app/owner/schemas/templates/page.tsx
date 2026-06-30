import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { createTemplate, duplicateTemplate } from "../actions";

export const metadata = { title: "Schemasjablonen" };

export default async function TemplatesPage() {
  const owner = await requireOwner();

  const templates = await prisma.workoutTemplate.findMany({
    where: { tenantId: owner.tenantId, isLibrary: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Herbruikbare schema-templates ({templates.length}).
        </p>
        <form action={createTemplate}>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            Nieuwe template
          </button>
        </form>
      </div>

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
            {templates.map((t) => (
              <tr key={t.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium text-neutral-900">
                  {t.name}
                </td>
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
            {templates.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-neutral-500">
                  Nog geen templates.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
