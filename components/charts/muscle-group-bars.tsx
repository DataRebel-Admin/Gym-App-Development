"use client";

import { m, useReducedMotion } from "motion/react";
import type { MuscleGroupCount } from "@/lib/member-stats";

/**
 * Horizontale balken voor de spiergroep-verdeling (op set-aantal). De breedte is
 * relatief t.o.v. de grootste groep; het percentage staat rechts. Accent-gevuld,
 * animeert bij in-view.
 */
export function MuscleGroupBars({
  data,
  max = 6,
}: {
  data: MuscleGroupCount[];
  max?: number;
}) {
  const reduced = useReducedMotion();
  const rows = data.slice(0, max);
  const top = rows[0]?.sets ?? 1;

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <div key={row.muscle} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-sm font-medium text-neutral-700">
            {row.muscle}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
            <m.div
              className="h-full rounded-full bg-accent-gradient"
              initial={{ width: reduced ? `${(row.sets / top) * 100}%` : 0 }}
              whileInView={{ width: `${(row.sets / top) * 100}%` }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: reduced ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-neutral-500">
            {row.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}
