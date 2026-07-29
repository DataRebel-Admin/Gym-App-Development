import { useTranslations } from "next-intl";
import type { LocationComparison } from "@/lib/metrics/queries";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { NonAdditiveNote } from "@/components/insights/non-additive-note";
import {
  TableWrap,
  Table,
  Thead,
  Th,
  Tbody,
  Tr,
  Td,
} from "@/components/ui/table";

const WEEKDAY_KEYS = [
  "weekdayMon",
  "weekdayTue",
  "weekdayWed",
  "weekdayThu",
  "weekdayFri",
  "weekdaySat",
  "weekdaySun",
] as const;

function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

/** No-show-drempels: ≤5% prima, ≤15% aandachtspunt, daarboven een probleem. */
function noShowTone(rate: number | null): BadgeTone {
  if (rate == null) return "neutral";
  if (rate <= 0.05) return "success";
  if (rate <= 0.15) return "warning";
  return "danger";
}

/**
 * Vestigingsvergelijking voor de eigenaar (en de gescopede variant voor een
 * vestigingsmanager): actieve leden / bezoeken / retentie / no-shows / piek per
 * vestiging + (alleen org-scope) het geconsolideerde totaal als voetrij.
 * Sync server component (useTranslations-idioom widget-bodies) — rendert op
 * /owner/insights (volledig) én als dashboard-widget (`compact`: zonder
 * piek-kolom en voetnoot, smaller minimum).
 */
export function LocationComparisonTable({
  data,
  compact = false,
}: {
  data: LocationComparison;
  compact?: boolean;
}) {
  const t = useTranslations("owner.insights");

  if (data.rows.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface-1 px-4 py-6 text-center text-sm text-neutral-500">
        {t("locationsEmpty")}
      </p>
    );
  }

  const maxVisits = data.rows.reduce((m, r) => Math.max(m, r.visits), 0);

  return (
    <div className="flex flex-col gap-3">
      <TableWrap>
        <Table className={compact ? "min-w-[540px]" : "min-w-[720px]"}>
          <Thead>
            <tr>
              <Th>{t("colLocation")}</Th>
              <Th className="text-right">{t("colActiveMembers")}</Th>
              <Th>{t("colVisits")}</Th>
              <Th className="text-right">{t("colRetention")}</Th>
              <Th className="text-right">{t("colNoShow")}</Th>
              {compact ? null : <Th className="text-right">{t("colPeak")}</Th>}
            </tr>
          </Thead>
          <Tbody>
            {data.rows.map((r) => (
              <Tr key={r.locationId}>
                <Td className="font-medium">
                  {r.name}
                  {r.isDefault ? (
                    <Badge tone="neutral" className="ml-2 text-[10px] uppercase tracking-wide">
                      {t("badgeMain")}
                    </Badge>
                  ) : null}
                </Td>
                <Td className="text-right tabular-nums">{r.activeMembers}</Td>
                <Td>
                  <div className="flex min-w-28 items-center gap-2">
                    <span className="w-10 shrink-0 text-right tabular-nums">{r.visits}</span>
                    <ProgressBar
                      value={maxVisits > 0 ? (r.visits / maxVisits) * 100 : 0}
                      trackClassName="h-1.5"
                      gradient
                    />
                  </div>
                </Td>
                <Td className="text-right tabular-nums">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {r.retention != null ? (
                      <ProgressRing value={r.retention * 100} size={22} strokeWidth={3.5} />
                    ) : null}
                    {pct(r.retention)}
                  </span>
                </Td>
                <Td className="text-right">
                  <Badge tone={noShowTone(r.noShowRate)} className="tabular-nums">
                    {pct(r.noShowRate)}
                    {r.noShow > 0 ? (
                      <span className="font-normal opacity-70">({r.noShow})</span>
                    ) : null}
                  </Badge>
                </Td>
                {compact ? null : (
                  <Td className="text-right text-xs text-neutral-600">
                    {r.peak
                      ? `${t(WEEKDAY_KEYS[r.peak.weekday])} ${String(r.peak.hour).padStart(2, "0")}:00`
                      : "—"}
                  </Td>
                )}
              </Tr>
            ))}
            {data.orgTotals ? (
              <Tr className="bg-surface-2/60 font-medium hover:bg-surface-2/60">
                <Td className="text-neutral-500">{t("allLocations")}</Td>
                <Td className="text-right tabular-nums">{data.orgTotals.activeMembers}</Td>
                <Td>
                  <span className="block w-10 text-right tabular-nums">{data.orgTotals.visits}</span>
                </Td>
                <Td className="text-right tabular-nums">{pct(data.orgTotals.retention)}</Td>
                <Td className="text-right tabular-nums">{pct(data.orgTotals.noShowRate)}</Td>
                {compact ? null : <Td>{null}</Td>}
              </Tr>
            ) : null}
          </Tbody>
        </Table>
      </TableWrap>

      {compact ? null : (
        <p className="text-xs text-neutral-400">{t("locationsFootnote", { days: data.windowDays })}</p>
      )}
      <NonAdditiveNote />
    </div>
  );
}
