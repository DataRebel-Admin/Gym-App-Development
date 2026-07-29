import { useTranslations } from "next-intl";
import type { MachineInsightRow } from "@/lib/insights";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TrendPill } from "@/components/insights/trend-pill";
import {
  TableWrap,
  Table,
  Thead,
  Th,
  Tbody,
  Tr,
  Td,
} from "@/components/ui/table";

/**
 * Machinegebruik als ranked tabel: sessies met verhoudingsbalk, totaal reps en
 * trend t.o.v. de vorige periode. Sync server component (bestaande i18n-keys).
 */
export function MachineTable({ rows }: { rows: MachineInsightRow[] }) {
  const t = useTranslations("owner.insights");
  const max = rows.reduce((m, r) => Math.max(m, r.sessions), 0);

  return (
    <TableWrap>
      <Table className="min-w-[420px]">
        <Thead>
          <tr>
            <Th>{t("colMachine")}</Th>
            <Th>{t("colSessions")}</Th>
            <Th className="text-right">{t("colTotalReps")}</Th>
            <Th className="text-right">{t("colTrend")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {rows.map((r) => (
            <Tr key={r.name}>
              <Td className="font-medium">{r.name}</Td>
              <Td>
                <div className="flex min-w-24 items-center gap-2">
                  <span className="w-8 shrink-0 text-right tabular-nums text-neutral-500">
                    {r.sessions}
                  </span>
                  <ProgressBar
                    value={max > 0 ? (r.sessions / max) * 100 : 0}
                    trackClassName="h-1.5"
                    gradient
                  />
                </div>
              </Td>
              <Td className="text-right tabular-nums text-neutral-500">{r.totalReps}</Td>
              <Td className="text-right">
                <TrendPill pct={r.trendPct} />
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
  );
}
