import Link from "next/link";
import type { ReactNode } from "react";
import { requireMember } from "@/lib/member";
import { prisma } from "@/lib/db";
import { requireMemberSchemaEnabled, resolveFramework } from "@/lib/member-schema";
import { getMemberCatalog } from "@/lib/member-catalog";
import {
  CATALOG_DAYS_OPTIONS,
  CATALOG_LEVEL_LABELS,
  catalogHref,
  exceedsFrameworkDays,
  filterCatalog,
  hasActiveCatalogFilter,
  parseCatalogFilters,
  rowDaysPerWeek,
  type CatalogFilters,
  type CatalogRow,
} from "@/lib/member-catalog-core";
import {
  hasGoalOverlap,
  parseTrainingGoals,
  sortByGoalMatch,
  trainingGoalOptions,
} from "@/lib/training-goals";
import { getCurrentTenant } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SchemaBadges } from "@/components/schema/schema-badges";
import { SchemaCover } from "@/components/schema/schema-cover";
import { ChevronLeft, ChevronRight, Dumbbell, Search } from "@/components/ui/icons";

export const metadata = { title: "Template-catalogus" };

type SearchParams = { type?: string; goal?: string; dagen?: string; niveau?: string; q?: string };

/** Nieuwe query-string met één filter aangepast (lege waarden vallen weg). */
function hrefWith(current: CatalogFilters, patch: Partial<Record<string, string | null>>): string {
  const params = new URLSearchParams();
  const merged: Record<string, string | null> = {
    type: current.type,
    goal: current.goal,
    dagen: current.days,
    niveau: current.level,
    q: current.q,
    ...patch,
  };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/member/schema/templates?${qs}` : "/member/schema/templates";
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-surface-1 text-neutral-600 active:bg-surface-2"
      }`}
    >
      {children}
    </Link>
  );
}

function TemplateCard({
  row,
  memberGoals,
  maxDays,
}: {
  row: CatalogRow;
  memberGoals: string[];
  maxDays: number | null;
}) {
  const matched = hasGoalOverlap(row.goals, memberGoals);
  const blocked = exceedsFrameworkDays(row, maxDays);
  const meta =
    row.type === "week"
      ? `${row.dayCount} ${row.dayCount === 1 ? "dag" : "dagen"} · ${row.exerciseCount} oefeningen`
      : `${row.exerciseCount} oefeningen${row.minutes ? ` · ±${row.minutes} min` : ""}`;
  return (
    <Link
      href={catalogHref(row)}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-3 active:bg-surface-2"
    >
      <SchemaCover
        image={row.image}
        alt={row.name}
        aspect={false}
        className="h-18 w-27 shrink-0 rounded-xl"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-display font-bold text-neutral-900">{row.name}</span>
          {matched ? <Badge tone="accent">Past bij jouw doel</Badge> : null}
        </span>
        <span className="mt-0.5 block text-xs text-neutral-500">
          {meta}
          {row.level ? ` · ${CATALOG_LEVEL_LABELS[row.level]}` : ""}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1">
          <SchemaBadges badges={row.badges} size="xs" max={3} />
          {blocked ? (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
              Max {maxDays} dagen in jouw kader
            </span>
          ) : null}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-neutral-300" />
    </Link>
  );
}

export default async function MemberTemplateCatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const member = await requireMember();
  await requireMemberSchemaEnabled(member.tenantId);
  const filters = parseCatalogFilters(await searchParams);

  const [tenant, user, framework] = await Promise.all([
    getCurrentTenant(),
    prisma.user.findUnique({ where: { id: member.id }, select: { trainingGoals: true } }),
    resolveFramework(member.tenantId, member.id),
  ]);
  const memberGoals = parseTrainingGoals(user?.trainingGoals);
  const maxDays = framework?.limits.maxDays ?? null;

  const catalog = await getMemberCatalog(member.tenantId, { logoUrl: tenant?.logoUrl ?? null });
  const rows = sortByGoalMatch(filterCatalog(catalog, filters), memberGoals, (r) => r.goals);
  const weeks = rows.filter((r) => r.type === "week");
  const days = rows.filter((r) => r.type === "day");

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-6">
      <div className="flex items-center gap-2">
        <Link
          href="/member/schema/builder"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 active:text-neutral-900"
        >
          <ChevronLeft className="size-4" /> Mijn schema&apos;s
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          Template-catalogus
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Kant-en-klare schema&apos;s en losse trainingsdagen. Kies er één en pas &apos;m
          daarna helemaal aan jezelf aan.
        </p>
        {memberGoals.length > 0 ? (
          <p className="mt-1 text-xs text-neutral-400">
            Gesorteerd op{" "}
            <Link href="/account/doelen" className="underline underline-offset-2">
              jouw doelen
            </Link>
            : wat bij je past staat bovenaan.
          </p>
        ) : null}
      </div>

      {/* Zoeken */}
      <form action="/member/schema/templates" className="relative">
        {filters.type ? <input type="hidden" name="type" value={filters.type} /> : null}
        {filters.goal ? <input type="hidden" name="goal" value={filters.goal} /> : null}
        {filters.days ? <input type="hidden" name="dagen" value={filters.days} /> : null}
        {filters.level ? <input type="hidden" name="niveau" value={filters.level} /> : null}
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Zoek een template…"
          className="w-full rounded-xl border border-border bg-surface-0 py-2.5 pl-9 pr-3 text-sm text-neutral-900 outline-none focus:border-accent"
        />
      </form>

      {/* Type-filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip href={hrefWith(filters, { type: null })} active={!filters.type}>
          Alles
        </FilterChip>
        <FilterChip href={hrefWith(filters, { type: "week" })} active={filters.type === "week"}>
          Complete schema&apos;s
        </FilterChip>
        <FilterChip href={hrefWith(filters, { type: "day" })} active={filters.type === "day"}>
          Losse dagen
        </FilterChip>
      </div>

      {/* Doel-filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip href={hrefWith(filters, { goal: null })} active={!filters.goal}>
          Elk doel
        </FilterChip>
        {trainingGoalOptions().map((o) => (
          <FilterChip
            key={o.value}
            href={hrefWith(filters, { goal: filters.goal === o.value ? null : o.value })}
            active={filters.goal === o.value}
          >
            {o.label}
          </FilterChip>
        ))}
      </div>

      {/* Meer filters: dagen per week + niveau */}
      <details className="rounded-2xl border border-border bg-surface-1 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
          Meer filters
          {filters.days || filters.level ? (
            <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
              actief
            </span>
          ) : null}
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Dagen per week
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CATALOG_DAYS_OPTIONS.map((o) => (
                <FilterChip
                  key={o.value}
                  href={hrefWith(filters, { dagen: filters.days === o.value ? null : o.value })}
                  active={filters.days === o.value}
                >
                  {o.label}
                </FilterChip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Niveau
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(CATALOG_LEVEL_LABELS).map(([value, label]) => (
                <FilterChip
                  key={value}
                  href={hrefWith(filters, { niveau: filters.level === value ? null : value })}
                  active={filters.level === value}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>
      </details>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="size-8 text-accent" />}
          title="Geen templates gevonden"
          description={
            hasActiveCatalogFilter(filters)
              ? "Probeer een andere combinatie van filters."
              : "Er staan nog geen templates in de catalogus."
          }
        />
      ) : null}

      {weeks.length > 0 && filters.type !== "day" ? (
        <section className="flex flex-col gap-2">
          {!filters.type ? (
            <h2 className="text-sm font-semibold text-neutral-900">Complete schema&apos;s</h2>
          ) : null}
          {weeks.map((row) => (
            <TemplateCard
              key={`${row.source}:${row.id}`}
              row={row}
              memberGoals={memberGoals}
              maxDays={maxDays}
            />
          ))}
        </section>
      ) : null}

      {days.length > 0 && filters.type !== "week" ? (
        <section className="flex flex-col gap-2">
          {!filters.type ? (
            <h2 className="text-sm font-semibold text-neutral-900">Losse trainingsdagen</h2>
          ) : null}
          {days.map((row) => (
            <TemplateCard
              key={`${row.source}:${row.id}`}
              row={row}
              memberGoals={memberGoals}
              maxDays={maxDays}
            />
          ))}
        </section>
      ) : null}

      <p className="text-center text-xs text-neutral-400">
        Liever helemaal zelf bouwen?{" "}
        <Link href="/member/schema/builder/new" className="underline underline-offset-2">
          Begin met een leeg schema
        </Link>
        .
      </p>
    </div>
  );
}
