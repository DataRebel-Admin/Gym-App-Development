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

/** Tooltip op module-niveau; `unit` wordt via props meegegeven en door recharts
 *  samengevoegd met active/payload/label. */
function MiniTooltip(props: {
  unit?: string;
  active?: boolean;
  label?: string | number;
  payload?: { value?: number | string }[];
}) {
  const { unit = "", active, payload, label } = props;
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-neutral-500">{label}</p>
      <p className="mt-0.5 font-display text-base font-bold text-neutral-900">
        {Number(payload[0]?.value).toLocaleString("nl-NL")}
        <span className="ml-1 text-xs font-normal text-neutral-500">{unit}</span>
      </p>
    </div>
  );
}

/**
 * Herbruikbaar staafdiagram voor een reeks `{ label, value }` (bv. weekvolume).
 * Accent-gradient-balken, strakke as. `unit` toont in de tooltip.
 */
export function MiniBarChart({
  data,
  unit = "",
  height = 200,
}: {
  data: { label: string; value: number }[];
  unit?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="miniBarAccent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tenant-accent)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="var(--tenant-accent)" stopOpacity={0.5} />
          </linearGradient>
        </defs>
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
          width={44}
          stroke="var(--muted-foreground)"
        />
        <Tooltip cursor={{ fill: "var(--accent-soft)" }} content={<MiniTooltip unit={unit} />} />
        <Bar dataKey="value" fill="url(#miniBarAccent)" radius={[6, 6, 0, 0]} animationDuration={700} />
      </BarChart>
    </ResponsiveContainer>
  );
}
