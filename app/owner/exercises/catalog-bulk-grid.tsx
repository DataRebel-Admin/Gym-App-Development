"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-classes";
import type { CatalogFilter } from "@/lib/catalog";
import { bulkAddCatalogToGym, removeCatalogExerciseFromGym } from "./actions";

export type CatalogGridItem = {
  id: string;
  name: string;
  imageUrl: string;
  bodyPart: string;
  equipment: string;
  target: string;
  added: boolean;
};

/**
 * Catalogus-grid met bulk-selectie: vink meerdere oefeningen aan (of selecteer
 * alle resultaten van het filter, ook over pagina's heen) en voeg ze in één keer
 * toe aan de sportschool. Reeds-toegevoegde oefeningen tonen hun status + een
 * verwijder-knop.
 */
export function CatalogBulkGrid({
  items,
  total,
  filter,
}: {
  items: CatalogGridItem[];
  total: number;
  filter: CatalogFilter;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [autoMachine, setAutoMachine] = useState(true);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  const addableIds = useMemo(() => items.filter((i) => !i.added).map((i) => i.id), [items]);
  const allPageSelected = addableIds.length > 0 && addableIds.every((id) => selected.has(id));
  const activeCount = allMatching ? total : selected.size;
  const hasSelection = allMatching || selected.size > 0;

  function toggle(id: string) {
    setAllMatching(false);
    setResult(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectPage() {
    setAllMatching(false);
    setResult(null);
    setSelected(new Set(addableIds));
  }

  function clear() {
    setAllMatching(false);
    setSelected(new Set());
  }

  function add() {
    start(async () => {
      const res = allMatching
        ? await bulkAddCatalogToGym({ allMatchingFilter: true, filter, autoMachine })
        : await bulkAddCatalogToGym({ catalogIds: [...selected], autoMachine });
      setResult(res);
      setSelected(new Set());
      setAllMatching(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Resultaat-banner */}
      <AnimatePresence>
        {result ? (
          <m.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            <span className="text-base">🎉</span>
            <span>
              <strong>{result.added}</strong> oefening{result.added === 1 ? "" : "en"} toegevoegd
              {result.skipped > 0 ? ` · ${result.skipped} overgeslagen (al in je sportschool)` : ""}.
            </span>
          </m.div>
        ) : null}
      </AnimatePresence>

      {/* Selectie-toolbar */}
      {addableIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={allPageSelected ? clear : selectPage}
            className="rounded-lg border border-border-strong px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {allPageSelected ? "Pagina deselecteren" : "Selecteer deze pagina"}
          </button>
          {total > items.length ? (
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setAllMatching(true);
                setSelected(new Set());
              }}
              className="rounded-lg border border-border-strong px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Selecteer alle {total} resultaten
            </button>
          ) : null}
          {hasSelection ? (
            <button
              type="button"
              onClick={clear}
              className="px-2 py-1.5 text-neutral-500 hover:text-neutral-900"
            >
              Wissen
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const checked = !item.added && (allMatching || selected.has(item.id));
          return (
            <div
              key={item.id}
              className={cn(
                "flex flex-col overflow-hidden rounded-2xl border transition-colors",
                checked ? "border-accent ring-2 ring-accent/25" : "border-neutral-200"
              )}
            >
              <button
                type="button"
                onClick={() => !item.added && toggle(item.id)}
                disabled={item.added}
                aria-pressed={checked}
                className="relative block aspect-square w-full bg-neutral-50 disabled:cursor-default"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-contain" />
                {!item.added ? (
                  <span
                    className={cn(
                      "absolute left-2 top-2 flex size-6 items-center justify-center rounded-md border-2 bg-surface-1 text-xs font-bold transition-colors",
                      checked ? "border-accent bg-accent text-accent-foreground" : "border-neutral-300 text-transparent"
                    )}
                  >
                    ✓
                  </span>
                ) : (
                  <span className="absolute left-2 top-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                    ✓ Toegevoegd
                  </span>
                )}
              </button>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-medium capitalize text-neutral-900">{item.name}</h2>
                  <Badge tone="neutral">Standaard</Badge>
                </div>
                <p className="text-xs capitalize text-neutral-500">
                  {item.bodyPart} · {item.equipment} · {item.target}
                </p>
                {item.added ? (
                  <form action={removeCatalogExerciseFromGym} className="mt-auto pt-1">
                    <input type="hidden" name="catalogId" value={item.id} />
                    <button type="submit" className="text-xs text-neutral-400 hover:text-red-600">
                      Verwijderen uit sportschool
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky actiebalk */}
      <AnimatePresence>
        {hasSelection ? (
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-1/95 px-4 py-3 shadow-lg backdrop-blur-xl"
          >
            <span className="text-sm font-semibold text-neutral-900">
              {allMatching ? `Alle ${total} resultaten` : `${activeCount} geselecteerd`}
            </span>
            <label className="flex items-center gap-1.5 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={autoMachine}
                onChange={(e) => setAutoMachine(e.target.checked)}
              />
              Auto-machine koppelen
            </label>
            <button
              type="button"
              onClick={add}
              disabled={pending}
              className={buttonClasses({ size: "sm", className: "min-w-44" })}
            >
              {pending ? "Toevoegen…" : `Toevoegen aan sportschool`}
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={pending}
              className="text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
            >
              Annuleren
            </button>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
