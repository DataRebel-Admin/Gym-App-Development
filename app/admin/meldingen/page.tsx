import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import {
  queryAppReports,
  queryReportCounters,
  getReportFilterOptions,
  parseReportSearchParams,
} from "@/lib/report-query";
import { getActionDef } from "@/lib/audit-actions";
import { SectionHeading } from "@/components/ui/section-heading";
import { buttonClasses } from "@/components/ui/button-classes";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportList, type ReportTimelineEntry } from "@/components/reports/report-list";

export const metadata = { title: "Meldingen" };

// Meldingen-inbox: alle probleem-/feedbackmeldingen over de app zelf, van
// leden én sportschool-gebruikers, in één lijst (herkomst-onderscheid via
// badge/filter). Alleen voor de superadmin.
export default async function AdminMeldingenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSuperadmin();
  const sp = await searchParams;
  const { filters, page } = parseReportSearchParams(sp);

  const [result, counters, options, tenants] = await Promise.all([
    queryAppReports(filters, page),
    queryReportCounters(),
    getReportFilterOptions(),
    prisma.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Statustijdlijn per melding, afgeleid uit de audit-log (geen apart model).
  const ids = result.rows.map((r) => r.id);
  const auditRows = ids.length
    ? await prisma.auditLog.findMany({
        where: { targetType: "AppReport", targetId: { in: ids } },
        orderBy: { createdAt: "desc" },
        select: { targetId: true, action: true, actorEmail: true, createdAt: true },
        take: 500,
      })
    : [];
  const timeline: Record<string, ReportTimelineEntry[]> = {};
  for (const row of auditRows) {
    if (!row.targetId) continue;
    (timeline[row.targetId] ??= []).push({
      at: row.createdAt.toISOString(),
      label: getActionDef(row.action).label,
      actor: row.actorEmail,
    });
  }

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][]
  );
  const pageHref = (p: number) => {
    const params = new URLSearchParams(qs);
    params.set("page", String(p));
    return `/admin/meldingen?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeading
        title="Meldingen"
        description="Problemen, feedback en vragen over de app — van leden én sportscholen, in één inbox."
      />

      {/* Tellers: piek na een release zie je hier direct. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Nieuw vandaag
          </p>
          <p className="mt-1 font-display text-3xl font-bold text-neutral-900">
            {counters.newToday}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Open
          </p>
          <p className="mt-1 font-display text-3xl font-bold text-neutral-900">
            {counters.open}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Open per app-versie
          </p>
          {counters.perVersion.length === 0 ? (
            <p className="mt-1 text-sm text-neutral-500">—</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-0.5 text-sm text-neutral-700">
              {counters.perVersion.map((v) => (
                <li key={v.appVersion} className="flex items-center justify-between">
                  <span className="truncate">{v.appVersion}</span>
                  <span className="font-semibold">{v.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ReportFilters
        tenants={tenants}
        platforms={options.platforms}
        versions={options.versions}
      />

      <ReportList rows={result.rows} timeline={timeline} />

      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          {result.total} meldingen · pagina {result.page} / {result.totalPages}
        </span>
        <div className="flex items-center gap-2">
          {result.page > 1 ? (
            <Link
              className={buttonClasses({ variant: "ghost", size: "sm" })}
              href={pageHref(result.page - 1)}
            >
              ← Vorige
            </Link>
          ) : null}
          {result.page < result.totalPages ? (
            <Link
              className={buttonClasses({ variant: "ghost", size: "sm" })}
              href={pageHref(result.page + 1)}
            >
              Volgende →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
