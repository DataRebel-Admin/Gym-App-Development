import { cn } from "@/lib/cn";
import { formatMetric, isMetricEnabled, type MetricKey } from "@/lib/measurement-meta";
import type { DeltaItem } from "@/lib/measurements";

/** Headline-voortgangsindicatoren: huidige waarde + verschil t.o.v. de vorige meting. */
export function ProgressDeltas({
  deltas,
  enabled = null,
}: {
  deltas: DeltaItem[];
  /** Door de owner geselecteerde meetvelden (`null` = alle). */
  enabled?: MetricKey[] | null;
}) {
  const shown = deltas.filter((d) => isMetricEnabled(d.key, enabled));
  if (shown.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {shown.map((d) => {
        const tone =
          d.tone === "good"
            ? "text-green-600"
            : d.tone === "bad"
              ? "text-red-600"
              : "text-neutral-500";
        const arrow = d.delta == null || d.delta === 0 ? "" : d.delta > 0 ? "↑" : "↓";
        const deltaText =
          d.delta == null
            ? "—"
            : `${arrow} ${d.delta > 0 ? "+" : ""}${formatMetric(d.key, d.delta)}`;
        return (
          <div
            key={d.key}
            className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface-1 p-4 shadow-sm"
          >
            <p className="truncate text-xs text-neutral-500" title={d.label}>
              {d.label}
            </p>
            <p className="mt-1 break-words font-display text-xl font-bold leading-tight tabular-nums text-neutral-900 sm:text-2xl">
              {d.current != null ? formatMetric(d.key, d.current) : "—"}
            </p>
            <p className={cn("mt-0.5 break-words text-xs font-semibold tabular-nums", tone)}>
              {deltaText}
            </p>
          </div>
        );
      })}
    </div>
  );
}
