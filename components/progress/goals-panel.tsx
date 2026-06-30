import { Badge } from "@/components/ui/badge";
import { GOAL_METRIC_LABEL, formatMetric } from "@/lib/measurement-meta";
import type { GoalProgress } from "@/lib/measurements";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

/** Read-only weergave van de doelen + voortgang (gedeeld owner/lid). */
export function GoalsPanel({ goals }: { goals: GoalProgress[] }) {
  if (goals.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface-0 px-4 py-6 text-center text-sm text-neutral-500">
        Nog geen doelen ingesteld.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {goals.map((g) => {
        const pct = g.percent ?? 0;
        return (
          <div key={g.id} className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-neutral-900">{GOAL_METRIC_LABEL[g.metric]}</span>
              {g.achieved ? (
                <Badge tone="success">🎉 Behaald</Badge>
              ) : g.percent != null ? (
                <Badge tone="accent">{g.percent}%</Badge>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-neutral-600">
              <span>
                Nu: <strong className="text-neutral-900">{formatMetric(g.metricKey, g.current)}</strong>
              </span>
              <span>
                Doel: <strong className="text-neutral-900">{formatMetric(g.metricKey, g.targetValue)}</strong>
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent-gradient transition-[width]"
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
            {g.targetDate ? (
              <p className="mt-1.5 text-xs text-neutral-400">
                Streefdatum: {DATE_FMT.format(new Date(g.targetDate))}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
