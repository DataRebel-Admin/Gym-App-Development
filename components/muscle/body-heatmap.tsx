"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import {
  MUSCLE_LEVELS,
  MUSCLE_LEVEL_COLOR,
  type BodyView,
  type MuscleLevel,
  type MuscleRegion,
} from "@/lib/muscle-map";
import type { RegionAnalysis } from "@/lib/muscle-analysis";

/**
 * Body-heatmap: een voor-/achteraanzicht van het lichaam waarin elke spierregio
 * gekleurd wordt op basis van het wekelijkse set-volume dat het schema eraan
 * besteedt (zie lib/muscle-map.ts). Tikken op een regio toont het detail.
 *
 * De figuur is bewust gestileerd (geen medische anatomie) — helder en
 * touch-vriendelijk (mobile-first), zoals de rest van de member-area.
 */
export function BodyHeatmap({ regions }: { regions: RegionAnalysis[] }) {
  const t = useTranslations("member.muscles");
  const [view, setView] = useState<BodyView>("front");
  const [selected, setSelected] = useState<MuscleRegion | null>(null);

  const byRegion = useMemo(() => {
    const m = new Map<MuscleRegion, RegionAnalysis>();
    for (const r of regions) m.set(r.region, r);
    return m;
  }, [regions]);

  const levelOf = (region: MuscleRegion): MuscleLevel =>
    byRegion.get(region)?.level ?? 0;

  /** Gedeelde props voor een klikbare spierregio-vorm. */
  const paint = (region: MuscleRegion) => ({
    fill: MUSCLE_LEVEL_COLOR[levelOf(region)],
    onClick: () => setSelected((cur) => (cur === region ? null : region)),
    className: "cursor-pointer transition-[fill,stroke] duration-500",
    stroke: selected === region ? "var(--neutral-900)" : "var(--border)",
    strokeWidth: selected === region ? 2.5 : 1,
    role: "button" as const,
    "aria-label": t(`regions.${region}`),
  });

  const sel = selected ? byRegion.get(selected) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Front / Back toggle */}
      <div className="mx-auto inline-flex rounded-full bg-surface-2 p-1">
        {(["front", "back"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setView(v);
              setSelected(null);
            }}
            className={cn(
              "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
              view === v
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-500"
            )}
          >
            {v === "front" ? t("front") : t("back")}
          </button>
        ))}
      </div>

      {/* Lichaam */}
      <svg
        viewBox="0 0 220 480"
        className="mx-auto h-[360px] w-auto"
        aria-label={`${t("heatmapTitle")} — ${view === "front" ? t("front") : t("back")}`}
      >
        <BaseBody />
        {view === "front" ? (
          <FrontMuscles paint={paint} />
        ) : (
          <BackMuscles paint={paint} />
        )}
      </svg>

      {/* Detail van geselecteerde regio */}
      <div className="min-h-[52px] rounded-2xl bg-surface-0 px-4 py-3 text-center">
        {sel ? (
          <>
            <p className="font-display text-base font-bold text-neutral-900">
              {t(`regions.${sel.region}`)}
            </p>
            <p className="mt-0.5 text-sm text-neutral-600">
              {sel.planWeekly > 0
                ? sel.actualWeekly > 0
                  ? t("detailPlanActual", {
                      plan: sel.planWeekly,
                      actual: sel.actualWeekly,
                    })
                  : t("detailPlan", { plan: sel.planWeekly })
                : t("detailNotTrained")}
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-500">{t("tapHint")}</p>
        )}
      </div>

      {/* Legenda */}
      <div className="flex items-stretch gap-1 px-1">
        {MUSCLE_LEVELS.filter((l) => l.level > 0).map((l) => (
          <div key={l.level} className="flex flex-1 flex-col items-center gap-1">
            <span
              className="h-2 w-full rounded-full"
              style={{ backgroundColor: l.color }}
            />
            <span className="text-[10px] leading-tight text-neutral-500">
              {t(`levels.${l.level}`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type PaintFn = (region: MuscleRegion) => Record<string, unknown>;

/** Grijze basissilhouet — gedeeld door beide aanzichten. */
function BaseBody() {
  return (
    <g className="fill-neutral-200 dark:fill-neutral-700">
      {/* hoofd + nek */}
      <circle cx="110" cy="34" r="20" />
      <rect x="100" y="50" width="20" height="18" rx="6" />
      {/* romp */}
      <path d="M74 72 Q62 72 61 94 L72 172 L82 234 L138 234 L148 172 L159 94 Q158 72 146 72 Z" />
      {/* bekken */}
      <path d="M82 232 L138 232 L133 276 Q110 288 87 276 Z" />
      {/* armen */}
      <rect x="45" y="78" width="23" height="96" rx="11" />
      <rect x="152" y="78" width="23" height="96" rx="11" />
      <rect x="43" y="168" width="21" height="90" rx="10" />
      <rect x="156" y="168" width="21" height="90" rx="10" />
      {/* benen */}
      <rect x="80" y="256" width="29" height="122" rx="13" />
      <rect x="111" y="256" width="29" height="122" rx="13" />
      <rect x="84" y="374" width="22" height="98" rx="11" />
      <rect x="114" y="374" width="22" height="98" rx="11" />
    </g>
  );
}

/** Spierregio's — voorkant. */
function FrontMuscles({ paint }: { paint: PaintFn }) {
  return (
    <g>
      {/* trapezius (bovenkant) */}
      <ellipse cx="90" cy="76" rx="13" ry="7" {...paint("traps")} />
      <ellipse cx="130" cy="76" rx="13" ry="7" {...paint("traps")} />
      {/* schouders */}
      <ellipse cx="57" cy="86" rx="13" ry="13" {...paint("shoulders")} />
      <ellipse cx="163" cy="86" rx="13" ry="13" {...paint("shoulders")} />
      {/* borst */}
      <ellipse cx="96" cy="104" rx="15" ry="13" {...paint("chest")} />
      <ellipse cx="124" cy="104" rx="15" ry="13" {...paint("chest")} />
      {/* biceps */}
      <ellipse cx="57" cy="126" rx="10" ry="22" {...paint("biceps")} />
      <ellipse cx="163" cy="126" rx="10" ry="22" {...paint("biceps")} />
      {/* onderarmen */}
      <ellipse cx="54" cy="208" rx="9" ry="34" {...paint("forearms")} />
      <ellipse cx="166" cy="208" rx="9" ry="34" {...paint("forearms")} />
      {/* buik */}
      <rect x="96" y="122" width="28" height="76" rx="9" {...paint("abs")} />
      {/* schuine buik */}
      <ellipse cx="87" cy="154" rx="6" ry="26" {...paint("obliques")} />
      <ellipse cx="133" cy="154" rx="6" ry="26" {...paint("obliques")} />
      {/* quadriceps */}
      <ellipse cx="94" cy="312" rx="14" ry="47" {...paint("quads")} />
      <ellipse cx="126" cy="312" rx="14" ry="47" {...paint("quads")} />
      {/* binnen-/buitenbeen (adductoren) */}
      <ellipse cx="104" cy="308" rx="6" ry="40" {...paint("adductors")} />
      <ellipse cx="116" cy="308" rx="6" ry="40" {...paint("adductors")} />
      {/* kuiten (scheenzijde) */}
      <ellipse cx="95" cy="418" rx="10" ry="40" {...paint("calves")} />
      <ellipse cx="125" cy="418" rx="10" ry="40" {...paint("calves")} />
    </g>
  );
}

/** Spierregio's — achterkant. */
function BackMuscles({ paint }: { paint: PaintFn }) {
  return (
    <g>
      {/* bovenrug (achter de traps) */}
      <rect x="90" y="94" width="40" height="42" rx="12" {...paint("upperBack")} />
      {/* trapezius (diamant) */}
      <path d="M110 72 L131 100 L110 124 L89 100 Z" {...paint("traps")} />
      {/* schouders (achterste deltoïde) */}
      <ellipse cx="57" cy="86" rx="13" ry="13" {...paint("shoulders")} />
      <ellipse cx="163" cy="86" rx="13" ry="13" {...paint("shoulders")} />
      {/* triceps */}
      <ellipse cx="57" cy="126" rx="10" ry="22" {...paint("triceps")} />
      <ellipse cx="163" cy="126" rx="10" ry="22" {...paint("triceps")} />
      {/* onderarmen */}
      <ellipse cx="54" cy="208" rx="9" ry="34" {...paint("forearms")} />
      <ellipse cx="166" cy="208" rx="9" ry="34" {...paint("forearms")} />
      {/* lats */}
      <ellipse cx="90" cy="146" rx="13" ry="24" {...paint("lats")} />
      <ellipse cx="130" cy="146" rx="13" ry="24" {...paint("lats")} />
      {/* onderrug */}
      <rect x="94" y="178" width="32" height="48" rx="10" {...paint("lowerBack")} />
      {/* bilspieren */}
      <ellipse cx="97" cy="252" rx="15" ry="18" {...paint("glutes")} />
      <ellipse cx="123" cy="252" rx="15" ry="18" {...paint("glutes")} />
      {/* hamstrings */}
      <ellipse cx="94" cy="322" rx="14" ry="46" {...paint("hamstrings")} />
      <ellipse cx="126" cy="322" rx="14" ry="46" {...paint("hamstrings")} />
      {/* kuiten */}
      <ellipse cx="95" cy="418" rx="11" ry="42" {...paint("calves")} />
      <ellipse cx="125" cy="418" rx="11" ry="42" {...paint("calves")} />
    </g>
  );
}
