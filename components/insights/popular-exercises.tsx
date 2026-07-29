import { useTranslations } from "next-intl";
import type { PopularExerciseRow } from "@/lib/insights";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TrendPill } from "@/components/insights/trend-pill";

/**
 * Populaire oefeningen als ranked list met verhoudingsbalken + trend —
 * de periode-parametrische tegenhanger van de dashboard-widget (die blijft
 * een vaste 30d-top zonder trend). Sync server component.
 */
export function PopularExercisesList({ rows }: { rows: PopularExerciseRow[] }) {
  const t = useTranslations("owner.insights");

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-neutral-500">{t("noExercises")}</p>;
  }

  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={r.id} className="flex items-center gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums text-neutral-500">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-neutral-900">{r.name}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="text-xs tabular-nums text-neutral-500">{r.count}×</span>
                <TrendPill pct={r.trendPct} />
              </span>
            </div>
            <ProgressBar
              value={max > 0 ? (r.count / max) * 100 : 0}
              trackClassName="mt-1.5 h-1.5"
              gradient
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
