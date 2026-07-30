import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { weekdayTotals, type OccupancyCell } from "@/lib/metrics/definitions";

const WEEKDAY_KEYS = [
  "weekdayMon",
  "weekdayTue",
  "weekdayWed",
  "weekdayThu",
  "weekdayFri",
  "weekdaySat",
  "weekdaySun",
] as const;

/** Getoonde uren: 06:00–23:00 — buiten dat venster is een sportschool zelden open. */
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

/** Intensiteit → tenant-accent met oplopende dekking (zelfde formule als de cellen). */
function cellColor(intensity: number): string {
  return `color-mix(in srgb, var(--tenant-accent) ${Math.round(15 + intensity * 85)}%, transparent)`;
}

/**
 * Bezetting per uur als CSS-grid-heatmap (weekdag × uur), één blok per
 * vestiging. Bewust géén recharts (leesbaarder + server-renderbaar); intensiteit
 * via de tenant-accentkleur met opacity. Data komt TZ-correct gebucket binnen
 * (lib/metrics/definitions.ts occupancyByHour). Facelift: legenda, gemarkeerde
 * piekcel + piek-caption en weekdag-totalen. Sync server component (i18n via
 * useTranslations — idioom widget-bodies).
 */
export function OccupancyHeatmap({
  cells,
  locations,
  windowDays = 30,
}: {
  cells: OccupancyCell[];
  locations: { id: string; name: string }[];
  windowDays?: number;
}) {
  const t = useTranslations("owner.insights");

  return (
    <div className="flex flex-col gap-4">
      {locations.map((loc) => {
        const own = cells.filter((c) => c.locationId === loc.id);
        const byKey = new Map(own.map((c) => [`${c.weekday}|${c.hour}`, c.count]));
        const max = own.reduce((m, c) => Math.max(m, c.count), 0);
        const peak = own.reduce<OccupancyCell | null>(
          (best, c) => (best == null || c.count > best.count ? c : best),
          null
        );
        const totals = weekdayTotals(own);
        return (
          <div key={loc.id} className="rounded-2xl border border-border bg-surface-1 p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-neutral-900">{loc.name}</p>
              {peak && max > 0 ? (
                <p className="text-xs text-neutral-500">
                  {t("peakLabel")}:{" "}
                  <span className="font-medium text-neutral-700">
                    {t(WEEKDAY_KEYS[peak.weekday])} {String(peak.hour).padStart(2, "0")}:00
                  </span>{" "}
                  · {t("cellVisits", { count: peak.count })}
                </p>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[560px] gap-[3px]"
                style={{
                  gridTemplateColumns: `2.25rem repeat(${HOURS.length}, minmax(0, 1fr)) 2.5rem`,
                }}
              >
                <div />
                {HOURS.map((h) => (
                  <div key={h} className="text-center text-[10px] tabular-nums text-neutral-400">
                    {h}
                  </div>
                ))}
                <div className="text-right text-[10px] font-medium uppercase text-neutral-400">
                  {t("weekdayTotal")}
                </div>
                {WEEKDAY_KEYS.map((dayKey, w) => (
                  <Fragment key={`${loc.id}-${dayKey}`}>
                    <div className="flex items-center text-[10px] font-medium uppercase text-neutral-400">
                      {t(dayKey)}
                    </div>
                    {HOURS.map((h) => {
                      const count = byKey.get(`${w}|${h}`) ?? 0;
                      const intensity = max > 0 ? count / max : 0;
                      const isPeak =
                        peak != null && max > 0 && peak.weekday === w && peak.hour === h;
                      return (
                        <div
                          key={`${loc.id}-${dayKey}-${h}`}
                          title={
                            count > 0
                              ? `${t(dayKey)} ${h}:00 · ${t("cellVisits", { count })}`
                              : undefined
                          }
                          className={`aspect-square rounded-[4px] bg-surface-2${
                            isPeak ? " ring-2 ring-neutral-900/60 ring-inset" : ""
                          }`}
                          style={intensity > 0 ? { backgroundColor: cellColor(intensity) } : undefined}
                        />
                      );
                    })}
                    <div className="flex items-center justify-end text-[10px] tabular-nums text-neutral-500">
                      {totals[w] > 0 ? totals[w] : ""}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              {max === 0 ? (
                <p className="text-xs text-neutral-400">{t("heatmapEmpty", { days: windowDays })}</p>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                <span>{t("legendLow")}</span>
                {[0.1, 0.3, 0.5, 0.75, 1].map((i) => (
                  <span
                    key={i}
                    className="size-3 rounded-[3px]"
                    style={{ backgroundColor: cellColor(i) }}
                    aria-hidden
                  />
                ))}
                <span>{t("legendHigh")}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
