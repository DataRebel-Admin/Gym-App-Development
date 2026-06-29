"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";

export function SessionsLineChart({
  data,
}: {
  data: { label: string; sessies: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="areaAccent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tenant-accent)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--tenant-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
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
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="sessies"
          stroke="var(--tenant-accent)"
          strokeWidth={2.5}
          fill="url(#areaAccent)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: "var(--tenant-accent)" }}
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
