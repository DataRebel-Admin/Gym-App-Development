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

export function SessionsBarChart({
  data,
}: {
  data: { day: string; sessies: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
        <Tooltip cursor={{ fill: "#f5f5f5" }} />
        <Bar
          dataKey="sessies"
          fill="var(--tenant-accent)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
