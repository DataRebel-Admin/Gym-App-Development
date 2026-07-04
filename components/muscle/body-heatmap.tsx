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
import {
  ANTERIOR,
  POSTERIOR,
  BODY_VIEWBOX,
  type BodyPart,
} from "./body-model-data";

/**
 * Body-heatmap: een anatomisch spierfiguur (voor/achter) waarin elke spiergroep
 * gekleurd wordt op het wekelijkse set-volume dat het schema eraan besteedt
 * (lib/muscle-map.ts). Tikken op een spier toont het detail.
 *
 * De spier-polygonen komen uit een **gevendorde, MIT-gelicentieerde dataset**
 * (react-body-highlighter, © 2020 GV79 — zie body-model-data.ts + body-model-LICENSE.txt).
 * De library-muscle-slugs zijn gemapt naar onze `MuscleRegion`; head/neck/knees zijn
 * grijs (region=null). Eén regio kan uit meerdere polygonen bestaan (bv. kuiten =
 * gastrocnemius + soleus) die kleur + klik delen.
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

  const parts: BodyPart[] = view === "front" ? ANTERIOR : POSTERIOR;
  const sel = selected ? byRegion.get(selected) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Front / Back toggle */}
      <div className="mx-auto inline-flex rounded-full bg-surface-2 p-1 ring-1 ring-border">
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
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            )}
          >
            {v === "front" ? t("front") : t("back")}
          </button>
        ))}
      </div>

      {/* Lichaam */}
      <svg
        viewBox={BODY_VIEWBOX}
        className="mx-auto h-[420px] w-auto"
        aria-label={`${t("heatmapTitle")} — ${view === "front" ? t("front") : t("back")}`}
      >
        {parts.map((part, pi) =>
          part.points.map((points, i) => {
            if (!part.region) {
              // head / neck / knees → grijze basis
              return (
                <polygon
                  key={`${pi}-${i}`}
                  points={points}
                  className="fill-neutral-200"
                  stroke="var(--surface-1)"
                  strokeWidth={0.3}
                />
              );
            }
            const region = part.region;
            const isSel = selected === region;
            return (
              <polygon
                key={`${pi}-${i}`}
                points={points}
                fill={MUSCLE_LEVEL_COLOR[levelOf(region)]}
                stroke={isSel ? "var(--neutral-900)" : "var(--surface-1)"}
                strokeWidth={isSel ? 1 : 0.4}
                className="cursor-pointer transition-[fill,stroke] duration-500"
                role="button"
                aria-label={t(`regions.${region}`)}
                onClick={() =>
                  setSelected((cur) => (cur === region ? null : region))
                }
              />
            );
          })
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
