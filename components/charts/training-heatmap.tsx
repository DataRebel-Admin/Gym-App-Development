"use client";

import { m, useReducedMotion } from "motion/react";
import type { HeatmapDay } from "@/lib/member-stats";

const DAY_LABELS = ["M", "", "W", "", "V", "", "Z"];
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** Accent-tint per intensiteit (0 = geen training). */
function level(count: number): string {
  if (count <= 0) return "var(--neutral-200)";
  if (count === 1) return "color-mix(in srgb, var(--tenant-accent) 45%, transparent)";
  if (count === 2) return "color-mix(in srgb, var(--tenant-accent) 70%, transparent)";
  return "var(--tenant-accent)";
}

/**
 * Consistentie-heatmap (GitHub-stijl): laatste ~16 weken trainingsdagen,
 * gegroepeerd per week-kolom (ma→zo). Accent-intensiteit ∝ aantal sessies.
 * `days` is chronologisch (oudste eerst) en begint op de juiste weekdag-offset.
 */
export function TrainingHeatmap({ days }: { days: HeatmapDay[] }) {
  const reduced = useReducedMotion();

  // Groepeer in weken (kolommen van 7, ma→zo). De eerste cel kan midden in een
  // week vallen → vul vooraan op met lege placeholders zodat rijen kloppen.
  const first = days[0] ? new Date(days[0].date) : new Date();
  const offset = (first.getDay() + 6) % 7; // ma=0
  const cells: (HeatmapDay | null)[] = [...Array(offset).fill(null), ...days];
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // Maand-labels boven kolommen (alleen bij maandwissel).
  const monthLabels = weeks.map((w) => {
    const firstDay = w.find((c): c is HeatmapDay => c != null);
    if (!firstDay) return "";
    const d = new Date(firstDay.date);
    return d.getDate() <= 7 ? MONTHS[d.getMonth()] : "";
  });

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px] pb-1">
        <div className="flex shrink-0 flex-col justify-end gap-[3px] pr-1 text-[9px] leading-none text-neutral-400">
          <div className="h-[14px]" aria-hidden />
          {DAY_LABELS.map((l, i) => (
            <div key={i} className="flex h-[13px] items-center">
              {l}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            <div className="h-[14px] text-[9px] leading-none text-neutral-400">
              {monthLabels[wi]}
            </div>
            {Array.from({ length: 7 }).map((_, di) => {
              const cell = week[di];
              if (!cell) return <div key={di} className="h-[13px] w-[13px]" />;
              return (
                <m.div
                  key={di}
                  title={`${cell.date}: ${cell.count} ${cell.count === 1 ? "training" : "trainingen"}`}
                  className="h-[13px] w-[13px] rounded-[3px]"
                  style={{ backgroundColor: level(cell.count) }}
                  initial={{ opacity: reduced ? 1 : 0, scale: reduced ? 1 : 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.2, delay: reduced ? 0 : Math.min(wi * 0.01, 0.4) }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-neutral-400">
        <span>minder</span>
        {[0, 1, 2, 3].map((c) => (
          <span
            key={c}
            className="h-[11px] w-[11px] rounded-[3px]"
            style={{ backgroundColor: level(c) }}
          />
        ))}
        <span>meer</span>
      </div>
    </div>
  );
}
