import Link from "next/link";
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
  if (pct === null) {
    return <span className="text-neutral-400">nieuw</span>;
  }
  if (pct === 0) return <span className="text-neutral-500">±0%</span>;
  const up = pct > 0;
  return (
    <span className={up ? "text-green-600" : "text-red-600"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

export const metadata = { title: "Inzichten" };

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const owner = await requireOwner();
  const { period: periodParam } = await searchParams;
  const period = parsePeriod(periodParam);

  const rows = await getMachineInsights(owner.tenantId, period);

  return (
    <Fullscreenable className="flex flex-col gap-6 px-6 py-8">
      <SectionHeading
        title="Inzichten"
        description="Machinegebruik en trends over de gekozen periode."
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
                  {p} dagen
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
              <Th>Machine</Th>
              <Th>Sessies</Th>
              <Th>Totaal reps</Th>
              <Th>Trend</Th>
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
                  Geen machines.
                </Td>
              </Tr>
            ) : null}
          </Tbody>
        </Table>
      </TableWrap>
      <p className="text-xs text-neutral-500">
        Trend vergelijkt de gekozen periode met de voorgaande periode van gelijke
        lengte. Cijfers verversen elke 5 minuten.
      </p>
    </Fullscreenable>
  );
}
