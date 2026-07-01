import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { Badge } from "@/components/ui/badge";
import { buildCatalogWhere, myEquipmentValues, type CatalogFilter } from "@/lib/catalog";
import { CatalogBulkGrid, type CatalogGridItem } from "./catalog-bulk-grid";
import { ExerciseTypeSelect } from "./exercise-type-select";
import { duplicateCustomExercise, setCustomExerciseArchived } from "./actions";

const PAGE_SIZE = 24;

type TabKey = "standaard" | "eigen";

type SearchParams = {
  tab?: string;
  q?: string;
  bodyPart?: string;
  equipment?: string;
  target?: string;
  /** "1" = alleen oefeningen voor de eigen apparatuur. */
  myeq?: string;
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

export async function generateMetadata() {
  const t = await getTranslations("owner.exercises");
  return { title: t("metaTitle") };
}

export default async function OwnerExercisesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const owner = await requirePermission("exercises:manage");
  const t = await getTranslations("owner.exercises");
  const sp = await searchParams;
  const tab: TabKey = sp.tab === "eigen" ? "eigen" : "standaard";

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{t("desc")}</p>
      </div>

      {/* Categorie-tabs */}
      <div className="flex w-fit gap-1 rounded-xl border border-border bg-surface-1 p-1">
        <TabLink active={tab === "standaard"} href="/owner/exercises?tab=standaard">
          {t("tabStandard")}
        </TabLink>
        <TabLink active={tab === "eigen"} href="/owner/exercises?tab=eigen">
          {t("tabCustom")}
        </TabLink>
      </div>

      {tab === "eigen" ? (
        <EigenTab tenantId={owner.tenantId} />
      ) : (
        <StandaardTab tenantId={owner.tenantId} sp={sp} />
      )}
    </div>
  );
}

function TabLink({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-accent text-accent-foreground shadow-sm"
          : "text-neutral-600 hover:text-neutral-900"
      }`}
    >
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Tab: Standaard oefeningen (centrale catalogus → toevoegen aan sportschool)
// ---------------------------------------------------------------------------

async function StandaardTab({
  tenantId,
  sp,
}: {
  tenantId: string;
  sp: SearchParams;
}) {
  const t = await getTranslations("owner.exercises");
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const filter: CatalogFilter = {
    q: sp.q || undefined,
    bodyPart: sp.bodyPart || undefined,
    equipment: sp.equipment || undefined,
    target: sp.target || undefined,
    onlyMyEquipment: sp.myeq === "1",
  };
  const myEquipment = filter.onlyMyEquipment ? await myEquipmentValues(tenantId) : null;
  const where = buildCatalogWhere(filter, myEquipment);

  const [items, total, bodyParts, equipments, targets, existing] =
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
      prisma.exercise.findMany({
        where: { tenantId, catalogId: { not: null } },
        select: { id: true, catalogId: true, exerciseType: true },
      }),
    ]);

  const byCatalogId = new Map(existing.map((e) => [e.catalogId, e]));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const gridItems: CatalogGridItem[] = items.map((item) => {
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

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-neutral-500">
        {t("catalogCount", { count: total })}
      </p>

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
        <FilterSelect label={t("filterBodyPart")} name="bodyPart" value={sp.bodyPart} options={bodyParts.map((b) => b.bodyPart)} allLabel={t("all")} />
        <FilterSelect label={t("filterEquipment")} name="equipment" value={sp.equipment} options={equipments.map((e) => e.equipment)} allLabel={t("all")} />
        <FilterSelect label={t("filterTarget")} name="target" value={sp.target} options={targets.map((x) => x.target)} allLabel={t("all")} />
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
        <CatalogBulkGrid items={gridItems} total={total} filter={filter} />
      )}

      {/* Paginering */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link
              href={`/owner/exercises${buildQuery(sp, { tab: "standaard", page: String(page - 1) })}`}
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
            {t("pageOf", { page, total: totalPages })}
          </span>
          {page < totalPages ? (
            <Link
              href={`/owner/exercises${buildQuery(sp, { tab: "standaard", page: String(page + 1) })}`}
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
  );
}

// ---------------------------------------------------------------------------
// Tab: Eigen oefeningen (tenant-Exercise zonder catalogus → volledig beheer)
// ---------------------------------------------------------------------------

async function EigenTab({ tenantId }: { tenantId: string }) {
  const t = await getTranslations("owner.exercises");
  const exercises = await prisma.exercise.findMany({
    where: { tenantId, catalogId: null },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      exerciseType: true,
      targetMuscle: true,
      category: true,
      difficulty: true,
      imageUrls: true,
      archivedAt: true,
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          {exercises.length === 0
            ? t("noCustom")
            : t("customCount", { count: exercises.length })}
        </p>
        <Link
          href="/owner/exercises/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          {t("newExercise")}
        </Link>
      </div>

      {exercises.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-neutral-600">{t("emptyHint")}</p>
          <Link
            href="/owner/exercises/new"
            className="mt-4 inline-block rounded-lg border-2 border-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            {t("firstExercise")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {exercises.map((ex) => {
            const archived = Boolean(ex.archivedAt);
            return (
              <div
                key={ex.id}
                className={`flex flex-col overflow-hidden rounded-2xl border border-neutral-200 ${
                  archived ? "opacity-60" : ""
                }`}
              >
                <div className="aspect-square w-full bg-neutral-50">
                  {ex.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ex.imageUrls[0]}
                      alt={ex.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl text-neutral-300">
                      🏋️
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-medium capitalize text-neutral-900">
                        {ex.name}
                      </h2>
                      <Badge tone="accent">{t("badgeCustom")}</Badge>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs capitalize text-neutral-500">
                      {ex.targetMuscle ? <span>{ex.targetMuscle}</span> : null}
                      {ex.category ? <span>· {ex.category}</span> : null}
                      {ex.difficulty ? (
                        <span>· {t(`diff${ex.difficulty}`)}</span>
                      ) : null}
                      {archived ? (
                        <Badge tone="warning">{t("badgeArchived")}</Badge>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">{t("typeLabel")}</span>
                    <ExerciseTypeSelect exerciseId={ex.id} value={ex.exerciseType} />
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Link
                      href={`/owner/exercises/${ex.id}/edit`}
                      className="font-medium text-accent hover:underline"
                    >
                      {t("edit")}
                    </Link>
                    <form action={duplicateCustomExercise}>
                      <input type="hidden" name="id" value={ex.id} />
                      <button type="submit" className="text-neutral-500 hover:text-neutral-900">
                        {t("duplicate")}
                      </button>
                    </form>
                    <form action={setCustomExerciseArchived}>
                      <input type="hidden" name="id" value={ex.id} />
                      <input type="hidden" name="archived" value={archived ? "false" : "true"} />
                      <button type="submit" className="text-neutral-500 hover:text-neutral-900">
                        {archived ? t("restore") : t("archive")}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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
  options: string[];
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
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
