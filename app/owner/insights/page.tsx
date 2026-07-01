import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { requireOwner } from "@/lib/owner";
import { getMachineInsights } from "@/lib/insights";
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
  searchParams: Promise<{ period?: string }>;
}) {
  const owner = await requireOwner();
  const t = await getTranslations("owner.insights");
  const { period: periodParam } = await searchParams;
  const period = parsePeriod(periodParam);

  const rows = await getMachineInsights(owner.tenantId, period);

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
                  href={`/owner/insights?period=${p}`}
                  className={`rounded-lg px-3 py-1 font-medium transition-colors ${
                    p === period
                      ? "bg-surface-1 text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  {t("days", { count: p })}
                </Link>
              ))}
            </div>
            <FullscreenButton />
          </div>
        }
      />

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
              <Tr key={r.name}>
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
      <p className="text-xs text-neutral-500">
        {t("footnote")}
      </p>
    </Fullscreenable>
  );
}
