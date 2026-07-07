import { cn } from "@/lib/cn";
import { formatMetric, formatMetricParts, isMetricEnabled, type MetricKey } from "@/lib/measurement-meta";
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
        const value = formatMetricParts(d.key, d.current);
        return (
          <div
            key={d.key}
            className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface-1 p-4 shadow-sm"
          >
            <p className="truncate text-xs text-neutral-500" title={d.label}>
              {d.label}
            </p>
            <p className="mt-1 flex items-baseline gap-1 whitespace-nowrap font-display leading-tight tabular-nums text-neutral-900">
              <span className="text-xl font-bold sm:text-2xl">{value.number}</span>
              {value.unit ? (
                <span className="text-sm font-semibold text-neutral-500">{value.unit}</span>
              ) : null}
            </p>
            <p className={cn("mt-0.5 whitespace-nowrap text-xs font-semibold tabular-nums", tone)}>
              {deltaText}
            </p>
          </div>
        );
      })}
    </div>
  );
}
