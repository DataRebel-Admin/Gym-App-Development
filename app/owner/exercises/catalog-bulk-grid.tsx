"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { buttonClasses } from "@/components/ui/button-classes";
import type { CatalogFilter } from "@/lib/catalog";
import type { CatalogPreview } from "@/lib/exercise";
import { bulkAddCatalogToGym, catalogPreview, removeCatalogExerciseFromGym } from "./actions";
import { ExerciseTypeSelect } from "./exercise-type-select";

export type CatalogGridItem = {
  id: string;
  name: string;
  imageUrl: string;
  bodyPart: string;
  equipment: string;
  target: string;
  added: boolean;
  /** Alleen wanneer toegevoegd: de tenant-Exercise-id + huidig type (override). */
  exerciseId?: string;
  exerciseType?: string;
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
  const t = useTranslations("owner.exercises");
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [autoMachine, setAutoMachine] = useState(true);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  // Detail-preview: klik op een kaart opent een modal met gif/spiergroepen/
  // instructies (lui geladen via de server-action). Selecteren gebeurt apart
  // via het vinkje linksboven.
  const [detailItem, setDetailItem] = useState<CatalogGridItem | null>(null);
  const [detail, setDetail] = useState<CatalogPreview | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function openDetail(item: CatalogGridItem) {
    setDetailItem(item);
    setDetail(null);
    setDetailLoading(true);
    catalogPreview(item.id)
      .then((p) => setDetail(p))
      .finally(() => setDetailLoading(false));
  }

  function closeDetail() {
    setDetailItem(null);
    setDetail(null);
    setDetailLoading(false);
  }

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
              {t.rich("resultAdded", {
                added: result.added,
                b: (c) => <strong>{c}</strong>,
              })}
              {result.skipped > 0 ? t("resultSkipped", { skipped: result.skipped }) : ""}.
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
            {allPageSelected ? t("deselectPage") : t("selectPage")}
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
              {t("selectAll", { total })}
            </button>
          ) : null}
          {hasSelection ? (
            <button
              type="button"
              onClick={clear}
              className="px-2 py-1.5 text-neutral-500 hover:text-neutral-900"
            >
              {t("clear")}
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
              <div className="relative aspect-square w-full bg-neutral-50">
                {/* Klik op de afbeelding = detail bekijken (niet selecteren). */}
                <button
                  type="button"
                  onClick={() => openDetail(item)}
                  aria-label={t("viewDetail", { name: item.name })}
                  className="block size-full cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-contain" />
                </button>
                {/* Selecteren = het vinkje linksboven (los van de detail-klik). */}
                {!item.added ? (
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-pressed={checked}
                    aria-label={checked ? t("deselect") : t("select")}
                    className={cn(
                      "absolute left-2 top-2 flex size-6 cursor-pointer items-center justify-center rounded-md border-2 text-xs font-bold shadow-sm transition-colors",
                      checked
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-neutral-300 bg-surface-1 text-transparent hover:border-accent"
                    )}
                  >
                    ✓
                  </button>
                ) : (
                  <span className="absolute left-2 top-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                    {t("addedBadge")}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openDetail(item)}
                    className="cursor-pointer truncate text-left font-medium capitalize text-neutral-900 hover:text-accent hover:underline"
                  >
                    {item.name}
                  </button>
                  <Badge tone="neutral">{t("badgeStandard")}</Badge>
                </div>
                <p className="text-xs capitalize text-neutral-500">
                  {item.bodyPart} · {item.equipment} · {item.target}
                </p>
                {item.added ? (
                  <div className="mt-auto flex flex-col gap-2 pt-1">
                    {item.exerciseId && item.exerciseType ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-neutral-400">{t("typeLabel")}</span>
                        <ExerciseTypeSelect
                          exerciseId={item.exerciseId}
                          value={item.exerciseType}
                        />
                      </div>
                    ) : null}
                    <form action={removeCatalogExerciseFromGym}>
                      <input type="hidden" name="catalogId" value={item.id} />
                      <button type="submit" className="text-xs text-neutral-400 hover:text-red-600">
                        {t("removeFromGym")}
                      </button>
                    </form>
                  </div>
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
              {allMatching ? t("allResults", { total }) : t("selectedCount", { count: activeCount })}
            </span>
            <label className="flex items-center gap-1.5 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={autoMachine}
                onChange={(e) => setAutoMachine(e.target.checked)}
              />
              {t("autoMachine")}
            </label>
            <button
              type="button"
              onClick={add}
              disabled={pending}
              className={buttonClasses({ size: "sm", className: "min-w-44" })}
            >
              {pending ? t("adding") : t("addToGym")}
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={pending}
              className="text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
            >
              {t("cancel")}
            </button>
          </m.div>
        ) : null}
      </AnimatePresence>

      {/* Detail-modal (lui geladen preview van de catalogus-oefening) */}
      <Modal
        open={detailItem !== null}
        onClose={closeDetail}
        title={detailItem?.name}
        className="max-w-lg"
      >
        {detailLoading || !detail ? (
          <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
            {t("loading")}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-xl bg-neutral-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={detail.gifUrl || detail.imageUrl || detailItem?.imageUrl}
                alt={detail.name}
                loading="lazy"
                className="mx-auto max-h-64 w-full object-contain"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {detail.bodyPart ? <Badge tone="neutral">{detail.bodyPart}</Badge> : null}
              {detail.equipment ? <Badge tone="neutral">{detail.equipment}</Badge> : null}
              {detail.target ? <Badge tone="accent">{detail.target}</Badge> : null}
              <Badge tone="neutral">{detail.difficulty}</Badge>
            </div>

            {detail.secondaryMuscles.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {t("secondaryMuscles")}
                </h3>
                <p className="mt-1 text-sm capitalize text-neutral-700">
                  {detail.secondaryMuscles.join(", ")}
                </p>
              </div>
            ) : null}

            {detail.steps.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {t("instructions")}
                </h3>
                <ol className="mt-1 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-neutral-700">
                  {detail.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            ) : detail.instructionsText ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {t("instructions")}
                </h3>
                <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">
                  {detail.instructionsText}
                </p>
              </div>
            ) : null}

            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t("consultProfessional")}
            </p>

            {detailItem && !detailItem.added ? (
              <button
                type="button"
                onClick={() => {
                  toggle(detailItem.id);
                  closeDetail();
                }}
                className={buttonClasses({ size: "sm", className: "w-full" })}
              >
                {selected.has(detailItem.id) ? t("deselect") : t("select")}
              </button>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
