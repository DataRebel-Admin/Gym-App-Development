import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { requirePermission } from "@/lib/staff";
import { getLocationScope } from "@/lib/location-access";
import { getTenantLocations } from "@/lib/locations";
import { canAccessLocation, canRollUp, type LocationScope } from "@/lib/location-scope";
import { getMachineInsights } from "@/lib/insights";
import { getLocationComparison } from "@/lib/metrics/queries";
import { LocationComparisonTable } from "@/components/insights/location-comparison";
import { OccupancyHeatmap } from "@/components/insights/occupancy-heatmap";
import { SectionHeading } from "@/components/ui/section-heading";
import { Fullscreenable, FullscreenButton } from "@/components/ui/fullscreen";
import {
  TableWrap,
  Table,
  Thead,
  Th,
  Tbody,
  Tr,
  Td,
} from "@/components/ui/table";

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

function parsePeriod(value: string | undefined): Period {
  const n = Number(value);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

function Trend({ pct }: { pct: number | null }) {
  const t = useTranslations("owner.insights");
  if (pct === null) {
    return <span className="text-neutral-400">{t("new")}</span>;
  }
  if (pct === 0) return <span className="text-neutral-500">±0%</span>;
  const up = pct > 0;
  return (
    <span className={up ? "text-green-600" : "text-red-600"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
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
  const t = await getTranslations("owner.insights");
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

  const [rows, comparison] = await Promise.all([
    getMachineInsights(user.tenantId, period, selectedScope),
    getLocationComparison(user.tenantId, selectedScope),
  ]);

  const heatmapLocations = comparison.rows.map((r) => ({ id: r.locationId, name: r.name }));
  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1 font-medium transition-colors ${
      active ? "bg-surface-1 text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"
    }`;

  return (
    <Fullscreenable className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeading
        title={t("title")}
        description={t("desc")}
        action={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-xl border border-border bg-surface-0 p-1 text-sm">
              {PERIODS.map((p) => (
                <Link
                  key={p}
                  href={`/owner/insights?period=${p}${loc ? `&loc=${loc}` : ""}`}
                  className={tabClass(p === period)}
                >
                  {t("days", { count: p })}
                </Link>
              ))}
            </div>
            <FullscreenButton />
          </div>
        }
      />

      {multiLocation ? (
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface-0 p-1 text-sm self-start">
          <Link href={`/owner/insights?period=${period}`} className={tabClass(!loc)}>
            {canRollUp(userScope) ? "Alle vestigingen" : "Mijn vestigingen"}
          </Link>
          {visibleLocations.map((l) => (
            <Link
              key={l.id}
              href={`/owner/insights?period=${period}&loc=${l.id}`}
              className={tabClass(loc === l.id)}
            >
              {l.name}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Vestigingsvergelijking: actieve leden / bezoeken / retentie / no-shows. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Vestigingen</h2>
        <LocationComparisonTable data={comparison} />
      </section>

      {/* Bezetting per uur (TZ van de vestiging). */}
      {heatmapLocations.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">Bezetting per uur</h2>
          <OccupancyHeatmap cells={comparison.occupancy} locations={heatmapLocations} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{t("colMachine")}s</h2>
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>{t("colMachine")}</Th>
                <Th>{t("colSessions")}</Th>
                <Th>{t("colTotalReps")}</Th>
                <Th>{t("colTrend")}</Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">{r.name}</Td>
                  <Td className="text-neutral-500">{r.sessions}</Td>
                  <Td className="text-neutral-500">{r.totalReps}</Td>
                  <Td>
                    <Trend pct={r.trendPct} />
                  </Td>
                </Tr>
              ))}
              {rows.length === 0 ? (
                <Tr>
                  <Td colSpan={4} className="py-8 text-center text-neutral-500">
                    {t("noMachines")}
                  </Td>
                </Tr>
              ) : null}
            </Tbody>
          </Table>
        </TableWrap>
      </section>
      <p className="text-xs text-neutral-500">
        {t("footnote")}
      </p>
    </Fullscreenable>
  );
}
