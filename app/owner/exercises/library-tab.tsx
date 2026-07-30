import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/features/service";
import {
  buildLibraryWhere,
  myLibraryEquipmentSlugs,
  LIBRARY_ORDER_BY,
  type LibraryFilter,
} from "@/lib/exercise-library/search";
import { buildCatalogWhere } from "@/lib/catalog";
import { libraryImageKeys, libraryMediaUrl } from "@/lib/exercise-library/media";
import {
  pickJsonName,
  LIBRARY_BODY_PART_LABEL,
  LIBRARY_DIFFICULTY_LABEL,
  LIBRARY_GOAL_LABEL,
} from "@/lib/exercise-library/mapping";
import { CatalogBulkGrid, type CatalogGridItem } from "./catalog-bulk-grid";

const PAGE_SIZE = 24;
/** Minder dan zoveel bibliotheek-hits bij een zoekterm → klap de klassieke
 *  terugval-sectie automatisch open ("staat er niet in? kijk in de oude"). */
const LEGACY_AUTO_OPEN_BELOW = 3;

export type LibraryTabSearchParams = {
  q?: string;
  bodyPart?: string;
  equipment?: string;
  difficulty?: string;
  goal?: string;
  /** "1" = alleen oefeningen voor de eigen apparatuur. */
  myeq?: string;
  page?: string;
  /** Klassieke terugval-sectie: "1" = expliciet opengeklapt; lpage = paginering. */
  lopen?: string;
  lpage?: string;
};

function buildQuery(
  base: LibraryTabSearchParams,
  overrides: Partial<LibraryTabSearchParams>
): string {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = { tab: "standaard", ...base, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * Standaard-tab: de oefeningen-bibliotheek (RepDB) als primaire bron, met —
 * indien de superadmin-flag `exercise_legacy_catalog` aan staat — de verouderde
 * catalogus als ingeklapte, duidelijk geoormerkte terugval-sectie eronder.
 * Nooit gemengd in één lijst; klassiek sorteert altijd achteraan.
 */
export async function LibraryTab({
  tenantId,
  sp,
}: {
  tenantId: string;
  sp: LibraryTabSearchParams;
}) {
  const t = await getTranslations("owner.exercises");
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const filter: LibraryFilter = {
    q: sp.q || undefined,
    bodyPart: sp.bodyPart || undefined,
    equipment: sp.equipment || undefined,
    difficulty: sp.difficulty || undefined,
    goal: sp.goal || undefined,
    onlyMyEquipment: sp.myeq === "1",
  };
  const myEquipment = filter.onlyMyEquipment
    ? await myLibraryEquipmentSlugs(tenantId)
    : null;
  const where = buildLibraryWhere(filter, myEquipment);

  const [items, total, allEquipment, allMuscles, existing] = await Promise.all([
    prisma.libraryExercise.findMany({
      where,
      orderBy: LIBRARY_ORDER_BY,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { texts: { where: { locale: "en" }, select: { name: true } } },
    }),
    prisma.libraryExercise.count({ where }),
    prisma.libraryEquipment.findMany({ select: { id: true, names: true } }),
    prisma.libraryMuscle.findMany({ select: { id: true, names: true } }),
    prisma.exercise.findMany({
      where: { tenantId, libraryId: { not: null } },
      select: { id: true, libraryId: true, exerciseType: true },
    }),
  ]);

  const equipName = new Map(
    allEquipment.map((e) => [e.id, pickJsonName(e.names, ["en"]) ?? e.id.replace(/_/g, " ")])
  );
  const muscleName = new Map(
    allMuscles.map((m) => [m.id, pickJsonName(m.names, ["en"]) ?? m.id.replace(/_/g, " ")])
  );
  const byLibraryId = new Map(existing.map((e) => [e.libraryId, e]));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const gridItems: CatalogGridItem[] = items.map((item) => {
    const added = byLibraryId.get(item.id);
    const thumbKey = libraryImageKeys(item)[0] ?? null;
    return {
      id: item.id,
      name: item.texts[0]?.name ?? item.id,
      imageUrl: libraryMediaUrl(thumbKey) ?? "",
      bodyPart: item.bodyPart ? (LIBRARY_BODY_PART_LABEL[item.bodyPart] ?? item.bodyPart) : "",
      equipment: item.equipmentSlug
        ? (equipName.get(item.equipmentSlug) ?? item.equipmentSlug)
        : "Lichaamsgewicht",
      target: item.primaryMuscles[0]
        ? (muscleName.get(item.primaryMuscles[0]) ?? item.primaryMuscles[0])
        : "",
      added: Boolean(added),
      exerciseId: added?.id,
      exerciseType: added?.exerciseType,
    };
  });

  const equipmentOptions = [...equipName.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // --- Klassieke terugval (feature-flag, alleen op zoekterm) ---------------
  const legacyEnabled = await isFeatureEnabled(tenantId, "exercise_legacy_catalog");
  const legacy = legacyEnabled ? await loadLegacySection(tenantId, sp) : null;
  const legacyAutoOpen = Boolean(
    filter.q && total < LEGACY_AUTO_OPEN_BELOW && (legacy?.total ?? 0) > 0
  );
  const legacyOpen = sp.lopen === "1" || legacyAutoOpen;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-neutral-500">{t("libraryCount", { count: total })}</p>

      {/* Filters (GET-form) */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value="standaard" />
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          {t("search")}
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder={t("namePlaceholder")}
            className="w-48 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
          />
        </label>
        <FilterSelect
          label={t("filterBodyPart")}
          name="bodyPart"
          value={sp.bodyPart}
          options={Object.entries(LIBRARY_BODY_PART_LABEL).map(([value, label]) => ({ value, label }))}
          allLabel={t("all")}
        />
        <FilterSelect
          label={t("filterEquipment")}
          name="equipment"
          value={sp.equipment}
          options={equipmentOptions}
          allLabel={t("all")}
        />
        <FilterSelect
          label={t("filterDifficulty")}
          name="difficulty"
          value={sp.difficulty}
          options={Object.entries(LIBRARY_DIFFICULTY_LABEL).map(([value, label]) => ({ value, label }))}
          allLabel={t("all")}
        />
        <FilterSelect
          label={t("filterGoal")}
          name="goal"
          value={sp.goal}
          options={Object.entries(LIBRARY_GOAL_LABEL).map(([value, label]) => ({ value, label }))}
          allLabel={t("all")}
        />
        <label className="flex items-center gap-2 pb-2 text-sm text-neutral-600">
          <input type="checkbox" name="myeq" value="1" defaultChecked={filter.onlyMyEquipment} />
          {t("forMyEquipment")}
        </label>
        <button
          type="submit"
          className="rounded-lg bg-accent-gradient px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:shadow-accent active:opacity-90"
        >
          {t("filter")}
        </button>
        <Link
          href="/owner/exercises?tab=standaard"
          className="px-2 py-2 text-sm text-neutral-500 hover:text-neutral-900"
        >
          {t("clear")}
        </Link>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {filter.onlyMyEquipment ? t("noResultsMyEq") : t("noResults")}
        </p>
      ) : (
        <CatalogBulkGrid items={gridItems} total={total} filter={filter} source="library" />
      )}

      {/* Paginering */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link
              href={`/owner/exercises${buildQuery(sp, { page: String(page - 1) })}`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
            >
              {t("prev")}
            </Link>
          ) : (
            <span className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-300">
              {t("prev")}
            </span>
          )}
          <span className="text-neutral-500">{t("pageOf", { page, total: totalPages })}</span>
          {page < totalPages ? (
            <Link
              href={`/owner/exercises${buildQuery(sp, { page: String(page + 1) })}`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
            >
              {t("next")}
            </Link>
          ) : (
            <span className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-300">
              {t("next")}
            </span>
          )}
        </div>
      ) : null}

      {/* Klassieke catalogus — verouderde terugvaloptie, nooit dominant. */}
      {legacy ? (
        <details
          open={legacyOpen}
          className="mt-2 rounded-2xl border border-dashed border-amber-300/70 bg-amber-50/40 open:bg-transparent"
        >
          <summary className="cursor-pointer select-none px-4 py-3 text-sm text-neutral-600 hover:text-neutral-900">
            <span className="font-medium">{t("legacyTitle")}</span>{" "}
            <span className="text-neutral-400">
              — {t("legacyMatches", { count: legacy.total })}
            </span>
          </summary>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <p className="text-xs text-neutral-500">{t("legacyHint")}</p>
            {legacy.items.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("noResults")}</p>
            ) : (
              <CatalogBulkGrid
                items={legacy.items}
                total={legacy.total}
                filter={{ q: sp.q || undefined }}
                source="catalog"
              />
            )}
            {legacy.totalPages > 1 ? (
              <div className="flex items-center justify-center gap-4 text-sm">
                {legacy.page > 1 ? (
                  <Link
                    href={`/owner/exercises${buildQuery(sp, { lopen: "1", lpage: String(legacy.page - 1) })}`}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
                  >
                    {t("prev")}
                  </Link>
                ) : (
                  <span className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-300">
                    {t("prev")}
                  </span>
                )}
                <span className="text-neutral-500">
                  {t("pageOf", { page: legacy.page, total: legacy.totalPages })}
                </span>
                {legacy.page < legacy.totalPages ? (
                  <Link
                    href={`/owner/exercises${buildQuery(sp, { lopen: "1", lpage: String(legacy.page + 1) })}`}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
                  >
                    {t("next")}
                  </Link>
                ) : (
                  <span className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-300">
                    {t("next")}
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/** Klassieke-catalogus-sectie: alléén de zoekterm als filter (het is een
 *  terugvaloptie, geen tweede etalage — de rijke filters gelden voor de
 *  bibliotheek). Eigen paginering via `lpage`. */
async function loadLegacySection(tenantId: string, sp: LibraryTabSearchParams) {
  const page = Math.max(1, Number(sp.lpage ?? "1") || 1);
  const where = buildCatalogWhere({ q: sp.q || undefined }, null);

  const [rows, total, existing] = await Promise.all([
    prisma.exerciseCatalog.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.exerciseCatalog.count({ where }),
    prisma.exercise.findMany({
      where: { tenantId, catalogId: { not: null } },
      select: { id: true, catalogId: true, exerciseType: true },
    }),
  ]);

  const byCatalogId = new Map(existing.map((e) => [e.catalogId, e]));
  const items: CatalogGridItem[] = rows.map((item) => {
    const added = byCatalogId.get(item.id);
    return {
      id: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      bodyPart: item.bodyPart,
      equipment: item.equipment,
      target: item.target,
      added: Boolean(added),
      exerciseId: added?.id,
      exerciseType: added?.exerciseType,
    };
  });

  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

function FilterSelect({
  label,
  name,
  value,
  options,
  allLabel,
}: {
  label: string;
  name: string;
  value?: string;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
      {label}
      <select
        name={name}
        defaultValue={value ?? ""}
        className="w-44 rounded-lg border border-neutral-300 px-3 py-2 text-sm capitalize text-neutral-900"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
