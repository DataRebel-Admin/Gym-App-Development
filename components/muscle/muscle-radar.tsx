"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { RegionAnalysis } from "@/lib/muscle-analysis";

/**
 * Radar-vergelijking: het schema-plan (streefvolume per spiergroep) tegen wat het
 * lid de laatste 4 weken écht getraind heeft. Beide in sets/week → direct
 * vergelijkbaar. Toont in één oogopslag of de sporter zijn schema volgt en welke
 * spiergroepen achterblijven.
 */
export function MuscleRadar({ regions }: { regions: RegionAnalysis[] }) {
  const t = useTranslations("member.muscles");

  const data = useMemo(
    () =>
      regions
        .filter((r) => r.planWeekly > 0 || r.actualWeekly > 0)
        .sort(
          (a, b) =>
            Math.max(b.planWeekly, b.actualWeekly) -
            Math.max(a.planWeekly, a.actualWeekly)
        )
        .slice(0, 9)
        .map((r) => ({
          label: t(`regions.${r.region}`),
          plan: r.planWeekly,
          actual: r.actualWeekly,
        })),
    [regions, t]
  );

  if (data.length < 3) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500">
        {t("notEnough")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="var(--neutral-300)" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--neutral-500)" }}
            />
            <Radar
              name={t("seriesPlan")}
              dataKey="plan"
              stroke="var(--neutral-500)"
              strokeDasharray="4 3"
              fill="var(--neutral-500)"
              fillOpacity={0.12}
            />
            <Radar
              name={t("seriesActual")}
              dataKey="actual"
              stroke="var(--tenant-accent)"
              fill="var(--tenant-accent)"
              fillOpacity={0.28}
            />
            <Tooltip
              formatter={(value, name) => [
                t("setsPerWeek", { count: Number(value) || 0 }),
                String(name),
              ]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--surface-1)",
                color: "var(--neutral-900)",
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--neutral-900)" }}
              itemStyle={{ color: "var(--neutral-700)" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-5 text-xs font-medium text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-5 rounded-full"
            style={{ backgroundColor: "var(--neutral-500)" }}
          />
          {t("seriesPlan")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-5 rounded-full"
            style={{ backgroundColor: "var(--tenant-accent)" }}
          />
          {t("seriesActual")}
        </span>
      </div>
    </div>
  );
}
