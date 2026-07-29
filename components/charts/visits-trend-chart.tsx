"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
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
 * Vaste seriekleuren voor vestiging-lijnen: serie 1 = tenant-accent, daarna een
 * klein, CVD-gevalideerd palet (dataviz-skill validator, alle checks groen tegen
 * de default-accent). Kleur volgt de vestiging (vaste volgorde), nooit gecycled —
 * de pagina valt boven MAX_TREND_SERIES terug op het totaal.
 */
export const TREND_SERIES_COLORS = [
  "var(--tenant-accent)",
  "#2563eb",
  "#0d9488",
  "#7c3aed",
  "#b45309",
] as const;
export const MAX_TREND_SERIES = TREND_SERIES_COLORS.length;

/**
 * Bezoeken-trend: één vestiging → area met accent-gradient (idioom
 * sessions-line-chart), meerdere vestigingen → multi-lijn met legenda.
 * Gradient-id via useId — er staan meerdere charts op de inzichten-pagina.
 */
export function VisitsTrendChart({
  data,
  series,
  unit,
  height = 260,
}: {
  /** Rijen `{ label, total, [serieKey]: n }` — labels server-side geformatteerd. */
  data: Array<Record<string, string | number>>;
  /** Lege lijst of één serie → totaal-area; anders één lijn per serie. */
  series: { key: string; name: string }[];
  unit: string;
  height?: number;
}) {
  const uid = useId();
  const gradientId = `visitsArea-${uid.replace(/[^a-zA-Z0-9]/g, "")}`;
  const multi = series.length > 1;

  const axes = (
    <>
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
        allowDecimals={false}
        tickLine={false}
        axisLine={false}
        fontSize={11}
        stroke="var(--muted-foreground)"
      />
      <Tooltip cursor={{ stroke: "var(--accent-soft)", strokeWidth: 24 }} content={<ChartTooltip unit={unit} />} />
    </>
  );

  if (!multi) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--tenant-accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--tenant-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {axes}
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--tenant-accent)"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "var(--tenant-accent)" }}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        {axes}
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={TREND_SERIES_COLORS[i % TREND_SERIES_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            animationDuration={800}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
