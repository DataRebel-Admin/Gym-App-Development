"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { levelForWeeklySets, type MuscleLevel } from "@/lib/muscle-map";
import {
  HEATMAP_LEVEL_OPACITY,
  type HeatmapView,
  type HeatmapViewAssets,
} from "@/lib/muscle-heatmap";
import type { HeatmapExerciseRow, ScheduleHeatmap } from "@/lib/muscle-analysis";

/**
 * Anatomische spier-heatmap op de RepDB muscle_heatmap-overlays (v1.41).
 *
 * - Het figuur = basisfoto + per spier een wit-met-alpha-overlay als CSS-mask,
 *   getint met `var(--tenant-accent)` en een opacity per volume-niveau
 *   (HEATMAP_LEVEL_OPACITY). De anatomische arcering zit in het alpha-kanaal.
 * - **Dagfilter**: chips uit de trainingsdagen van het actieve schema — per dag
 *   zie je waar de nadruk ligt; "Hele week" is het totaal.
 * - **Tik-selectie** loopt via de same-origin indexkaart-PNG's in
 *   public/muscle-heatmap/ (pixelwaarde = spier-index+1, volgorde =
 *   `heatmapViewMuscles()` — het contract met `npm run muscles:heatmap`;
 *   goedkoper dan alle overlays client-side decoderen). Nogmaals tikken
 *   deselecteert. N.B. de overlays zelf vereisen wél CORS op het
 *   storage-account (mask-image = CORS-request) — het script zet die regel.
 * - Het detailpaneel toont de oefeningen uit het schema die de spier belasten
 *   (doel-samenvatting, primair/secundair, dag).
 */

type HitmapData = { data: Uint8ClampedArray; width: number; height: number };

const FIGURE_HEIGHT = 420;

export function AnatomicalHeatmap({
  data,
  assets,
}: {
  data: ScheduleHeatmap;
  assets: Record<HeatmapView, HeatmapViewAssets>;
}) {
  const t = useTranslations("member.muscles");
  const [view, setView] = useState<HeatmapView>("front");
  const [dayKey, setDayKey] = useState<string>("week");
  const [selected, setSelected] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hitmaps = useRef<Partial<Record<HeatmapView, HitmapData>>>({});

  const viewAssets = assets[view];
  const volumes = data.volumes[dayKey] ?? {};

  // Indexkaart van het actieve aanzicht laden (één keer per aanzicht).
  useEffect(() => {
    if (hitmaps.current[view]) return;
    const img = new Image();
    img.src = viewAssets.hitmapPath;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      hitmaps.current[view] = {
        data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        width: canvas.width,
        height: canvas.height,
      };
    };
  }, [view, viewAssets.hitmapPath]);

  function onStageClick(e: React.MouseEvent) {
    const hit = hitmaps.current[view];
    const stage = stageRef.current;
    if (!hit || !stage) return;
    const rect = stage.getBoundingClientRect();
    const x = Math.min(
      hit.width - 1,
      Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * hit.width))
    );
    const y = Math.min(
      hit.height - 1,
      Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * hit.height))
    );
    // Grayscale-PNG: rood kanaal = indexwaarde (0 = geen spier).
    const index = hit.data[(y * hit.width + x) * 4];
    const name = index > 0 ? (viewAssets.muscles[index - 1]?.name ?? null) : null;
    setSelected((cur) => (name != null && cur === name ? null : name));
  }

  const levelOf = (name: string): MuscleLevel => levelForWeeklySets(volumes[name] ?? 0);

  const selectedRows: HeatmapExerciseRow[] = selected
    ? data.exercises.filter(
        (e) =>
          (dayKey === "week" || e.dayId === dayKey) &&
          (e.primary.includes(selected) || e.secondary.includes(selected))
      )
    : [];
  const selectedVolume = selected ? (volumes[selected] ?? 0) : 0;
  const selectedWeekVolume = selected ? (data.volumes.week?.[selected] ?? 0) : 0;
  const selectedLevel = selected ? levelOf(selected) : 0;

  const figureWidth = FIGURE_HEIGHT / viewAssets.aspect;

  return (
    <div className="flex flex-col gap-4">
      {/* Dagfilter (alleen bij meerdaagse schema's) */}
      {data.days.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {[{ id: "week", name: t("heat.wholeWeek") }, ...data.days].map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={dayKey === d.id}
              onClick={() => setDayKey(d.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                dayKey === d.id
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "bg-surface-2 text-neutral-500 ring-1 ring-border hover:text-neutral-800"
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {/* Voor / achter */}
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

      {/* Figuur */}
      <div
        ref={stageRef}
        onClick={onStageClick}
        role="img"
        aria-label={`${t("heatmapTitle")}: ${view === "front" ? t("front") : t("back")}`}
        className="relative mx-auto cursor-pointer touch-manipulation select-none"
        style={{ height: FIGURE_HEIGHT, width: figureWidth }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- externe Azure-media, geen optimizer nodig */}
        <img
          src={viewAssets.baseUrl}
          alt=""
          className="absolute inset-0 h-full w-full"
          draggable={false}
        />
        {viewAssets.muscles.map((m) => {
          const level = levelOf(m.name);
          const isSel = selected === m.name;
          if (level === 0 && !isSel) return null;
          const dimmed = selected != null && !isSel;
          const opacity = Math.max(
            HEATMAP_LEVEL_OPACITY[level] * (dimmed ? 0.2 : 1),
            isSel ? 0.25 : 0
          );
          return m.urls.map((url) => (
            <div
              key={url}
              aria-hidden
              className="pointer-events-none absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none"
              style={{
                backgroundColor: "var(--tenant-accent)",
                opacity,
                maskImage: `url(${url})`,
                WebkitMaskImage: `url(${url})`,
                maskSize: "100% 100%",
                WebkitMaskSize: "100% 100%",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                filter: isSel ? "drop-shadow(0 0 6px var(--tenant-accent))" : undefined,
              }}
            />
          ));
        })}
      </div>

      {/* Detail van de aangetikte spier + bijdragende oefeningen */}
      <div className="min-h-[52px] rounded-2xl bg-surface-0 px-4 py-3">
        {selected ? (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-display text-base font-bold text-neutral-900">
                {t(`heat.muscles.${selected}`)}
              </p>
              {selectedLevel > 0 && (
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                  {t(`levels.${selectedLevel}`)}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-neutral-600">
              {selectedVolume > 0
                ? dayKey === "week"
                  ? t("heat.weekSets", { sets: fmtSets(selectedVolume) })
                  : t("heat.daySets", {
                      sets: fmtSets(selectedVolume),
                      week: fmtSets(selectedWeekVolume),
                    })
                : t("detailNotTrained")}
            </p>
            {selectedRows.length > 0 ? (
              <>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  {dayKey === "week" ? t("heat.exercisesWeek") : t("heat.exercisesDay")}
                </p>
                <ul className="mt-1 max-h-48 divide-y divide-border overflow-y-auto">
                  {selectedRows.map((row, i) => (
                    <li
                      key={`${row.dayId}-${row.name}-${i}`}
                      className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
                    >
                      <span className="font-semibold text-neutral-800">{row.name}</span>
                      <span className="whitespace-nowrap text-xs tabular-nums text-neutral-500">
                        {row.summary}
                        {row.secondary.includes(selected) && ` · ${t("heat.secondary")}`}
                        {dayKey === "week" && data.days.length > 1 && ` · ${row.dayName}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">
                {dayKey === "week" ? t("heat.noExercisesWeek") : t("heat.noExercisesDay")}
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-neutral-500">{t("heat.tapHint")}</p>
        )}
      </div>

      {/* Legenda: tenant-accent in vijf intensiteiten */}
      <div className="flex items-stretch gap-1 px-1">
        {([1, 2, 3, 4, 5] as const).map((level) => (
          <div key={level} className="flex flex-1 flex-col items-center gap-1">
            <span className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <span
                className="absolute inset-0"
                style={{
                  backgroundColor: "var(--tenant-accent)",
                  opacity: HEATMAP_LEVEL_OPACITY[level],
                }}
              />
            </span>
            <span className="text-[10px] leading-tight text-neutral-500">
              {t(`levels.${level}`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtSets(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}
