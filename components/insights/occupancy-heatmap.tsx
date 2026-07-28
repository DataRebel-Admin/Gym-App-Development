import { Fragment } from "react";
import type { OccupancyCell } from "@/lib/metrics/definitions";

const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
/** Getoonde uren: 06:00–23:00 — buiten dat venster is een sportschool zelden open. */
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

/**
 * Bezetting per uur als CSS-grid-heatmap (weekdag × uur), één blok per
 * vestiging. Bewust géén recharts (leesbaarder + server-renderbaar); intensiteit
 * via de tenant-accentkleur met opacity. Data komt TZ-correct gebucket binnen
 * (lib/metrics/definitions.ts occupancyByHour). Owner-area, NL.
 */
export function OccupancyHeatmap({
  cells,
  locations,
}: {
  cells: OccupancyCell[];
  locations: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {locations.map((loc) => {
        const own = cells.filter((c) => c.locationId === loc.id);
        const byKey = new Map(own.map((c) => [`${c.weekday}|${c.hour}`, c.count]));
        const max = own.reduce((m, c) => Math.max(m, c.count), 0);
        return (
          <div key={loc.id} className="rounded-2xl border border-border bg-surface-1 p-4">
            <p className="mb-3 text-sm font-semibold text-neutral-900">{loc.name}</p>
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[540px] gap-[3px]"
                style={{ gridTemplateColumns: `2.25rem repeat(${HOURS.length}, minmax(0, 1fr))` }}
              >
                <div />
                {HOURS.map((h) => (
                  <div key={h} className="text-center text-[10px] tabular-nums text-neutral-400">
                    {h}
                  </div>
                ))}
                {WEEKDAYS.map((day, w) => (
                  <Fragment key={`${loc.id}-${day}`}>
                    <div className="flex items-center text-[10px] font-medium uppercase text-neutral-400">
                      {day}
                    </div>
                    {HOURS.map((h) => {
                      const count = byKey.get(`${w}|${h}`) ?? 0;
                      const intensity = max > 0 ? count / max : 0;
                      return (
                        <div
                          key={`${loc.id}-${day}-${h}`}
                          title={count > 0 ? `${day} ${h}:00 — ${count} bezoeken` : undefined}
                          className="aspect-square rounded-[4px] bg-surface-2"
                          style={
                            intensity > 0
                              ? {
                                  backgroundColor: `color-mix(in srgb, var(--tenant-accent) ${Math.round(
                                    15 + intensity * 85
                                  )}%, transparent)`,
                                }
                              : undefined
                          }
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
            {max === 0 ? (
              <p className="mt-2 text-xs text-neutral-400">Nog geen bezoeken in de laatste 30 dagen.</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
