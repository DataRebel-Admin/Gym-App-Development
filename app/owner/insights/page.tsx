import { getLocale, getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/staff";
import { getLocationScope } from "@/lib/location-access";
import { getTenantLocations } from "@/lib/locations";
import { canAccessLocation, canRollUp, type LocationScope } from "@/lib/location-scope";
import { getMachineInsights, getPopularExercises } from "@/lib/insights";
import {
  getLocationComparison,
  getInsightsTrends,
  type InsightsWindow,
} from "@/lib/metrics/queries";
import type { Granularity } from "@/lib/metrics/definitions";
import { LocationComparisonTable } from "@/components/insights/location-comparison";
import { OccupancyHeatmap } from "@/components/insights/occupancy-heatmap";
import { InsightsHero } from "@/components/insights/insights-hero";
import { LinkTabs } from "@/components/insights/link-tabs";
import { MachineTable } from "@/components/insights/machine-table";
import { PopularExercisesList } from "@/components/insights/popular-exercises";
import { VisitsTrendChart } from "@/components/charts/visits-trend-chart.lazy";
import { MAX_TREND_SERIES } from "@/components/charts/visits-trend-chart";
import { ClassTrendChart } from "@/components/charts/class-trend-chart.lazy";
import { MiniBarChart } from "@/components/charts/mini-bar-chart.lazy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

const PERIODS = [7, 30, 90] as const satisfies readonly InsightsWindow[];

function parsePeriod(value: string | undefined): InsightsWindow {
  const n = Number(value);
  return (PERIODS as readonly number[]).includes(n) ? (n as InsightsWindow) : 30;
}

/** Bucket-sleutel ("2026-07-23") → kort gelokaliseerd as-label ("23-7"). */
function bucketLabel(key: string, locale: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export async function generateMetadata() {
  const t = await getTranslations("owner.insights");
  return { title: t("metaTitle") };
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; loc?: string }>;
}) {
  // Analytics zijn permissie-gestuurd (analytics:view; admin passeert als
  // superset). De vestiging-scope is een RESTRICTIE: een medewerker ziet
  // uitsluitend gekoppelde vestigingen; alleen de admin ziet org-totalen.
  const user = await requirePermission("analytics:view");
  const [t, locale] = await Promise.all([getTranslations("owner.insights"), getLocale()]);
  const { period: periodParam, loc } = await searchParams;
  const period = parsePeriod(periodParam);

  const [userScope, allLocations] = await Promise.all([
    getLocationScope(user),
    getTenantLocations(user.tenantId),
  ]);

  // Vestiging-tabs: "alle" = de volledige eigen scope; een specifieke vestiging
  // alleen als die binnen de scope valt (server-side afgedwongen — geen
  // client-input vertrouwd).
  const selectedScope: LocationScope =
    loc && canAccessLocation(userScope, loc) ? { kind: "locations", ids: [loc] } : userScope;

  const visibleLocations = allLocations.filter((l) => canAccessLocation(userScope, l.id));
  const multiLocation = visibleLocations.length > 1;

  const [machineRows, comparison, trends, popular] = await Promise.all([
    getMachineInsights(user.tenantId, period, selectedScope),
    getLocationComparison(user.tenantId, selectedScope, period),
    getInsightsTrends(user.tenantId, selectedScope, period),
    getPopularExercises(user.tenantId, period, selectedScope),
  ]);

  // KPI-hero: org-totalen bij roll-up; bij een selectie van precies één
  // vestiging de rij-waarde; anders géén actieve-leden/retentie-KPI
  // (vestigingswaarden zijn niet optelbaar — zie NonAdditiveNote).
  const singleRow = comparison.rows.length === 1 ? comparison.rows[0] : null;
  const activeMembers = comparison.orgTotals?.activeMembers ?? singleRow?.activeMembers ?? null;
  const retention = comparison.orgTotals
    ? comparison.orgTotals.retention
    : (singleRow?.retention ?? null);
  const retentionPct = retention == null ? null : Math.round(retention * 100);

  // Bezoeken-chart: per-vestiging-lijnen alleen binnen het vaste seriepalet;
  // daarboven bewust het (optelbare) totaal met een expliciete melding.
  const multiSeries = trends.series.length > 1 && trends.series.length <= MAX_TREND_SERIES;
  const visitData = trends.visits.map((row) => ({
    ...row,
    label: bucketLabel(String(row.bucket), locale),
  }));
  const visitSeries = multiSeries
    ? trends.series.map((s) => ({ key: s.locationId, name: s.name }))
    : [];
  const classData = trends.classes.points.map((p) => ({
    label: bucketLabel(p.bucket, locale),
    occupancyPct: p.occupancyPct,
    noShowPct: p.noShowPct,
  }));
  const captionKey: Record<Granularity, "perDayCaption" | "perWeekCaption"> = {
    day: "perDayCaption",
    week: "perWeekCaption",
  };
  const chartCaption = t(captionKey[trends.granularity], { count: period });

  const heatmapLocations = comparison.rows.map((r) => ({ id: r.locationId, name: r.name }));

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeading
        title={t("title")}
        description={t("desc")}
        action={
          <LinkTabs
            items={PERIODS.map((p) => ({
              href: `/owner/insights?period=${p}${loc ? `&loc=${loc}` : ""}`,
              label: t("days", { count: p }),
              active: p === period,
            }))}
          />
        }
      />

      {multiLocation ? (
        <LinkTabs
          className="self-start"
          items={[
            {
              href: `/owner/insights?period=${period}`,
              label: canRollUp(userScope) ? t("allLocations") : t("myLocations"),
              active: !loc,
            },
            ...visibleLocations.map((l) => ({
              href: `/owner/insights?period=${period}&loc=${l.id}`,
              label: l.name,
              active: loc === l.id,
            })),
          ]}
        />
      ) : null}

      <InsightsHero
        windowDays={period}
        visitsTotal={trends.visitsTotal}
        visitsTrendPct={trends.visitsTrendPct}
        activeMembers={activeMembers}
        newMembersTotal={trends.signups.total}
        newMembersTrendPct={trends.signups.trendPct}
        retentionPct={retentionPct}
        noShowPct={trends.classes.noShowPct}
      />

      {/* Bezoeken-trend over tijd (sessies + aanwezig gemelde les-deelnames). */}
      <Card>
        <CardHeader className="flex-row items-baseline justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">{t("sectionVisits")}</CardTitle>
            <p className="text-sm text-neutral-500">{t("sectionVisitsDesc")}</p>
          </div>
          <span className="shrink-0 text-xs text-neutral-400">{chartCaption}</span>
        </CardHeader>
        <CardContent>
          {trends.visitsTotal === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">{t("chartEmpty")}</p>
          ) : (
            <>
              <VisitsTrendChart data={visitData} series={visitSeries} unit={t("unitVisits")} />
              {!multiSeries && trends.series.length > 1 ? (
                <p className="mt-2 text-xs text-neutral-400">
                  {t("visitsAggregatedNote", { count: trends.series.length })}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ledengroei: nieuwe aanmeldingen per bucket. */}
        <Card>
          <CardHeader className="flex-row items-baseline justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">{t("sectionGrowth")}</CardTitle>
              <p className="text-sm text-neutral-500">{t("sectionGrowthDesc")}</p>
            </div>
            <span className="shrink-0 text-xs text-neutral-400">
              {t("signupsTotal", { count: trends.signups.total })}
            </span>
          </CardHeader>
          <CardContent>
            {trends.signups.total === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">{t("chartEmpty")}</p>
            ) : (
              <MiniBarChart
                data={trends.signups.points.map((p) => ({
                  label: bucketLabel(p.bucket, locale),
                  value: p.count,
                }))}
                unit={t("unitMembers")}
              />
            )}
          </CardContent>
        </Card>

        {/* Lesbezetting & no-shows: historisch verloop (het dashboard toont
            juist de kómende lessen — bewust complementair). */}
        <Card>
          <CardHeader className="flex-row items-baseline justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">{t("sectionClasses")}</CardTitle>
              <p className="text-sm text-neutral-500">{t("sectionClassesDesc")}</p>
            </div>
            <span className="shrink-0 text-xs text-neutral-400">
              {t("classesTotal", { count: trends.classes.sessionsTotal })}
            </span>
          </CardHeader>
          <CardContent>
            {trends.classes.sessionsTotal === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">{t("chartEmpty")}</p>
            ) : (
              <ClassTrendChart
                data={classData}
                occupancyLabel={t("occupancyLine")}
                noShowLabel={t("noShowLine")}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vestigingsvergelijking: actieve leden / bezoeken / retentie / no-shows. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{t("sectionLocations")}</h2>
        <LocationComparisonTable data={comparison} />
      </section>

      {/* Bezetting per uur (TZ van de vestiging). */}
      {heatmapLocations.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">{t("sectionOccupancy")}</h2>
          <OccupancyHeatmap
            cells={comparison.occupancy}
            locations={heatmapLocations}
            windowDays={comparison.windowDays}
          />
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">{t("sectionMachines")}</h2>
          <MachineTable rows={machineRows} />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">{t("sectionPopular")}</h2>
          <Card>
            <CardContent>
              <PopularExercisesList rows={popular} />
            </CardContent>
          </Card>
        </section>
      </div>

      <p className="text-xs text-neutral-500">
        {t("footnote")} {t("retentionExplainer")}
      </p>
    </div>
  );
}
