"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";

/**
 * Lesbezetting & no-show-verloop: twee percentages op één 0–100-as.
 * Bezetting = accent (doorgetrokken), no-show = signaalrood (gestippeld —
 * status-kleur + lijnstijl, dus niet kleur-alleen). `connectNulls` overbrugt
 * buckets zonder lessen.
 */
export function ClassTrendChart({
  data,
  occupancyLabel,
  noShowLabel,
  height = 260,
}: {
  data: { label: string; occupancyPct: number | null; noShowPct: number | null }[];
  occupancyLabel: string;
  noShowLabel: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          stroke="var(--muted-foreground)"
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tickLine={false}
          axisLine={false}
          fontSize={11}
          stroke="var(--muted-foreground)"
        />
        <Tooltip content={<ChartTooltip unit="%" />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="occupancyPct"
          name={occupancyLabel}
          stroke="var(--tenant-accent)"
          strokeWidth={2.5}
          dot={false}
          connectNulls
          activeDot={{ r: 4, strokeWidth: 0, fill: "var(--tenant-accent)" }}
          animationDuration={800}
        />
        <Line
          type="monotone"
          dataKey="noShowPct"
          name={noShowLabel}
          stroke="#dc2626"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          connectNulls
          activeDot={{ r: 4, strokeWidth: 0, fill: "#dc2626" }}
          animationDuration={800}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
