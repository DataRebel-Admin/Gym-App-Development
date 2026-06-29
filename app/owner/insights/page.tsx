import Link from "next/link";
import { requireOwner } from "@/lib/owner";
import { getMachineInsights } from "@/lib/insights";

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
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/owner" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
            Inzichten
          </h1>
        </div>
        <div className="flex gap-1 rounded-lg border border-neutral-200 p-1 text-sm">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/owner/insights?period=${p}`}
              className={`rounded-md px-3 py-1 ${
                p === period
                  ? "bg-accent text-accent-foreground"
                  : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {p} dagen
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Machine</th>
              <th className="px-4 py-2 font-medium">Sessies</th>
              <th className="px-4 py-2 font-medium">Totaal reps</th>
              <th className="px-4 py-2 font-medium">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium text-neutral-900">{r.name}</td>
                <td className="px-4 py-2 text-neutral-700">{r.sessions}</td>
                <td className="px-4 py-2 text-neutral-700">{r.totalReps}</td>
                <td className="px-4 py-2">
                  <Trend pct={r.trendPct} />
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                  Geen machines.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">
        Trend vergelijkt de gekozen periode met de voorgaande periode van gelijke
        lengte. Cijfers verversen elke 5 minuten.
      </p>
    </div>
  );
}
