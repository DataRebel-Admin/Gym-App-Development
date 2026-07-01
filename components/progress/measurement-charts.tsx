"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/cn";
import {
  METRICS,
  METRIC_BY_KEY,
  PRIMARY_METRICS,
  RANGES,
  type MetricKey,
  type RangeKey,
} from "@/lib/measurement-meta";
import type { SeriesPoint } from "@/lib/measurements";

/** Interactieve voortgangsgrafiek: kies metric + periode (30d…alles). */
export function MeasurementCharts({ points }: { points: SeriesPoint[] }) {
  const [metric, setMetric] = useState<MetricKey>("weightKg");
  const [range, setRange] = useState<RangeKey>("90d");
  // Eénmalig "nu" (lazy init is rein) — voor de periode-cutoff.
  const [now] = useState(() => Date.now());
  const def = METRIC_BY_KEY[metric];

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? null;
    const cutoff = days ? now - days * 86400_000 : 0;
    return points
      .filter((p) => p.ts >= cutoff)
      .map((p) => ({ date: p.date, value: p[metric] ?? null }))
      .filter((p) => p.value != null);
  }, [points, metric, range, now]);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as MetricKey)}
          className="rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-sm font-medium text-neutral-900"
        >
          <optgroup label="Lichaamssamenstelling">
            {METRICS.filter((m) => m.group === "composition").map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </optgroup>
          <optgroup label="Conditie">
            {METRICS.filter((m) => m.group === "condition").map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </optgroup>
          <optgroup label="Omtrek">
            {METRICS.filter((m) => m.group === "circumference").map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </optgroup>
        </select>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                range === r.key
                  ? "bg-accent text-accent-foreground"
                  : "text-neutral-500 hover:bg-neutral-100"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {data.length < 2 ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          Te weinig data voor deze periode — leg meer metingen vast.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              width={48}
              domain={["auto", "auto"]}
              unit={def.unit ? ` ${def.unit}` : ""}
            />
            <Tooltip formatter={(value) => [`${value}${def.unit ? ` ${def.unit}` : ""}`, def.label]} />
            <Line
              type="monotone"
              dataKey="value"
              name={def.label}
              stroke="var(--tenant-accent)"
              strokeWidth={2.5}
              dot={{ r: 2.5 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="flex flex-wrap gap-1.5">
        {PRIMARY_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              metric === m.key
                ? "bg-accent-soft text-accent"
                : "bg-surface-2 text-neutral-600 hover:bg-neutral-100"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
