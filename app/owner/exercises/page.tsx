import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { machineTypeLabel, suggestMachineType } from "@/lib/machine";
import {
  addCatalogExerciseToGym,
  removeCatalogExerciseFromGym,
} from "./actions";

const PAGE_SIZE = 24;

type SearchParams = {
  q?: string;
  bodyPart?: string;
  equipment?: string;
  target?: string;
  page?: string;
};

function buildQuery(base: SearchParams, overrides: Partial<SearchParams>): string {
  const params = new URLSearchParams();
  const merged = { ...base, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export default async function OwnerExercisesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const owner = await requireOwner();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const where: Prisma.ExerciseCatalogWhereInput = {
    ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" } } : {}),
    ...(sp.bodyPart ? { bodyPart: sp.bodyPart } : {}),
    ...(sp.equipment ? { equipment: sp.equipment } : {}),
    ...(sp.target ? { target: sp.target } : {}),
  };

  const [items, total, bodyParts, equipments, targets, machines, existing] =
    await Promise.all([
      prisma.exerciseCatalog.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.exerciseCatalog.count({ where }),
      prisma.exerciseCatalog.findMany({
        distinct: ["bodyPart"],
        select: { bodyPart: true },
        orderBy: { bodyPart: "asc" },
      }),
      prisma.exerciseCatalog.findMany({
        distinct: ["equipment"],
        select: { equipment: true },
        orderBy: { equipment: "asc" },
      }),
      prisma.exerciseCatalog.findMany({
        distinct: ["target"],
        select: { target: true },
        orderBy: { target: "asc" },
      }),
      prisma.machine.findMany({
        where: { tenantId: owner.tenantId },
        select: { id: true, name: true, type: true },
        orderBy: { name: "asc" },
      }),
      prisma.exercise.findMany({
        where: { tenantId: owner.tenantId, catalogId: { not: null } },
        select: { catalogId: true },
      }),
    ]);

  const inGym = new Set(existing.map((e) => e.catalogId));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Oefeningenbibliotheek
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Kies oefeningen uit de globale catalogus ({total} resultaten) en voeg
          ze toe aan jouw sportschool. Koppel ze eventueel aan een machine.
        </p>
      </div>

      {/* Filters (GET-form) */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Zoeken
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="naam…"
            className="w-48 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
          />
        </label>
        <FilterSelect label="Lichaamsdeel" name="bodyPart" value={sp.bodyPart} options={bodyParts.map((b) => b.bodyPart)} />
        <FilterSelect label="Apparatuur" name="equipment" value={sp.equipment} options={equipments.map((e) => e.equipment)} />
        <FilterSelect label="Doelspier" name="target" value={sp.target} options={targets.map((t) => t.target)} />
        <button
          type="submit"
          className="rounded-lg bg-accent-gradient px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:shadow-accent active:opacity-90"
        >
          Filter
        </button>
        <Link
          href="/owner/exercises"
          className="px-2 py-2 text-sm text-neutral-500 hover:text-neutral-900"
        >
          Wissen
        </Link>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Geen oefeningen gevonden.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const added = inGym.has(item.id);
            const suggested = suggestMachineType(item.equipment);
            const preMachine =
              machines.find((m) => m.type === suggested)?.id ?? "";
            return (
              <div
                key={item.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200"
              >
                <div className="aspect-square w-full bg-neutral-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h2 className="font-medium capitalize text-neutral-900">
                      {item.name}
                    </h2>
                    <p className="mt-0.5 text-xs capitalize text-neutral-500">
                      {item.bodyPart} · {item.equipment} · {item.target}
                    </p>
                  </div>

                  <div className="mt-auto">
                    {added ? (
                      <form action={removeCatalogExerciseFromGym}>
                        <input type="hidden" name="catalogId" value={item.id} />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-accent">
                            ✓ In sportschool
                          </span>
                          <button
                            type="submit"
                            className="text-xs text-neutral-400 hover:text-red-600"
                          >
                            Verwijderen
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form action={addCatalogExerciseToGym} className="flex flex-col gap-2">
                        <input type="hidden" name="catalogId" value={item.id} />
                        <label className="flex flex-col gap-1 text-xs text-neutral-500">
                          Machine (voorstel: {machineTypeLabel(suggested)})
                          <select
                            name="machineId"
                            defaultValue={preMachine}
                            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900"
                          >
                            <option value="">Geen machine</option>
                            {machines.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({machineTypeLabel(m.type)})
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="submit"
                          className="rounded-lg border-2 border-neutral-900 px-3 py-2 text-sm font-semibold text-neutral-900 active:bg-neutral-50"
                        >
                          + Toevoegen
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginering */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link
              href={`/owner/exercises${buildQuery(sp, { page: String(page - 1) })}`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
            >
              ← Vorige
            </Link>
          ) : (
            <span className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-300">
              ← Vorige
            </span>
          )}
          <span className="text-neutral-500">
            Pagina {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/owner/exercises${buildQuery(sp, { page: String(page + 1) })}`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
            >
              Volgende →
            </Link>
          ) : (
            <span className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-300">
              Volgende →
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value?: string;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
      {label}
      <select
        name={name}
        defaultValue={value ?? ""}
        className="w-44 rounded-lg border border-neutral-300 px-3 py-2 text-sm capitalize text-neutral-900"
      >
        <option value="">Alle</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
