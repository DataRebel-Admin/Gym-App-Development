"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";

export function SessionsBarChart({
  data,
}: {
  data: { day: string; sessies: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="barAccent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tenant-accent)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="var(--tenant-accent)" stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="var(--muted-foreground)"
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="var(--muted-foreground)"
        />
        <Tooltip
          cursor={{ fill: "var(--accent-soft)" }}
          content={<ChartTooltip />}
        />
        <Bar
          dataKey="sessies"
          fill="url(#barAccent)"
          radius={[6, 6, 0, 0]}
          animationDuration={700}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
