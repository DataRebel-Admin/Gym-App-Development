"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExerciseSeries } from "@/lib/member";

export function HistoryChart({ series }: { series: ExerciseSeries[] }) {
  const [selected, setSelected] = useState(series[0]?.exerciseId ?? "");

  if (series.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Nog geen gewichtsdata. Log een training om je progressie te zien.
      </p>
    );
  }

  const current = series.find((s) => s.exerciseId === selected) ?? series[0];

  return (
    <div className="flex flex-col gap-3">
      <select
        value={current.exerciseId}
        onChange={(e) => setSelected(e.target.value)}
        className="self-start rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-accent"
      >
        {series.map((s) => (
          <option key={s.exerciseId} value={s.exerciseId}>
            {s.name}
          </option>
        ))}
      </select>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={current.points}
          margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            unit="kg"
          />
          <Tooltip formatter={(v) => [`${v} kg`, "max"]} />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="var(--tenant-accent)"
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
