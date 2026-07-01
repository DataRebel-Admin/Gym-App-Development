import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { Badge } from "@/components/ui/badge";
import { describeLimits } from "@/lib/member-schema-constraints";
import { createFramework } from "./actions";

export const metadata = { title: "Kaders | Schema's" };

export default async function FrameworksPage() {
  const owner = await requirePermission("schemas:manage");

  const frameworks = await prisma.schemaFramework.findMany({
    where: { tenantId: owner.tenantId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Kaders voor zelf-schema&apos;s</h2>
        <p className="text-sm text-neutral-500">
          Bepaal binnen welke grenzen leden zelf een schema mogen samenstellen: toegestane
          oefeningen, aantal dagen en grenzen aan sets/herhalingen/rust. Eén kader kan de
          tenant-standaard zijn; overige koppel je per lid.
        </p>
      </div>

      <form action={createFramework}>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          + Nieuw kader
        </button>
      </form>

      {frameworks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-neutral-400">
          Nog geen kaders. Zonder kader mogen leden vrij kiezen uit alle oefeningen.
        </p>
      ) : (
        <ul className="flex max-w-3xl flex-col gap-2">
          {frameworks.map((f) => {
            const chips = describeLimits({
              allowedExerciseIds: f.allowedExerciseIds,
              allowedTypes: f.allowedTypes,
              minDays: f.minDays,
              maxDays: f.maxDays,
              minExercisesPerDay: f.minExercisesPerDay,
              maxExercisesPerDay: f.maxExercisesPerDay,
              setsMin: f.setsMin,
              setsMax: f.setsMax,
              repsMin: f.repsMin,
              repsMax: f.repsMax,
              restMin: f.restMin,
              restMax: f.restMax,
            });
            return (
              <li
                key={f.id}
                className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-900">{f.name}</span>
                  {f.isDefault ? <Badge tone="accent">Standaard</Badge> : null}
                  <span className="text-xs text-neutral-400">
                    {f._count.assignments} lid-koppeling(en)
                  </span>
                  <Link
                    href={`/owner/schemas/frameworks/${f.id}`}
                    className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Bewerken
                  </Link>
                </div>
                {chips.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-neutral-600"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400">Geen beperkingen ingesteld.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
