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
 * Body-heatmap: een anatomisch mensfiguur in een open ("wijdgespreide") houding —
 * armen naar buiten gedraaid om de schouder, benen uit elkaar om de heup, zodat de
 * spiergroepen los van elkaar liggen. Elke spier wordt gekleurd op het wekelijkse
 * set-volume dat het schema eraan besteedt (lib/muscle-map.ts); tikken toont detail.
 *
 * Opbouw: een statische romp + per ledemaat een **geroteerde groep** (silhouet +
 * spieren) rond een schouder-/heuppivot. Alle vormen zijn de linkerhelft; de
 * rechterhelft komt uit `mirrorPath()` (spiegelt M/L/C/Z om x=200). Eén regio kan
 * meerdere vormen hebben (quads = 3, abs = 4) die kleur/klik delen.
 */

const CX = 200;
const A_ARM = 28; // schouderrotatie (armen wijd)
const A_LEG = 13; // heuprotatie (benen uit elkaar)
const PVA_X = 150, PVA_Y = 176; // schouderpivot (links)
const PVL_X = 156, PVL_Y = 440; // heuppivot (links)

/** Spiegel een absoluut M/L/C/Z-pad om x=CX. */
function mirrorPath(d: string): string {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? [];
  let ci = 0;
  return toks
    .map((tk) => {
      if (/[a-zA-Z]/.test(tk)) {
        ci = 0;
        return tk;
      }
      const n = parseFloat(tk);
      const v = ci % 2 === 0 ? +(2 * CX - n).toFixed(1) : n;
      ci++;
      return String(v);
    })
    .join(" ");
}

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

  const paint = (region: MuscleRegion) => ({
    fill: MUSCLE_LEVEL_COLOR[levelOf(region)],
    onClick: () => setSelected((cur) => (cur === region ? null : region)),
    className: "cursor-pointer transition-[fill,stroke] duration-500",
    stroke: selected === region ? "var(--neutral-900)" : "var(--surface-1)",
    strokeWidth: selected === region ? 2.5 : 1,
    vectorEffect: "non-scaling-stroke" as const,
    role: "button" as const,
    "aria-label": t(`regions.${region}`),
  });

  /** Silhouet-vorm (grijs, niet klikbaar). */
  const Sil = ({ d }: { d: string }) => (
    <path d={d} className="fill-neutral-200" />
  );

  /** Een geroteerd ledemaat: silhouet + spieren, evt. gespiegeld. */
  const Limb = ({
    angle,
    px,
    py,
    sil,
    muscles,
    mir,
  }: {
    angle: number;
    px: number;
    py: number;
    sil: string;
    muscles: Shape[];
    mir: boolean;
  }) => {
    const tf = (d: string) => (mir ? mirrorPath(d) : d);
    return (
      <g transform={`rotate(${angle} ${px} ${py})`}>
        <Sil d={tf(sil)} />
        {muscles.map(([region, d], i) => (
          <path key={i} d={tf(d)} {...paint(region)} />
        ))}
      </g>
    );
  };

  const armMuscles = view === "front" ? ARM_FRONT : ARM_BACK;
  const legMuscles = view === "front" ? LEG_FRONT : LEG_BACK;
  const torsoMuscles = view === "front" ? TORSO_FRONT : TORSO_BACK;
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
        viewBox="20 8 360 864"
        className="mx-auto h-[440px] w-auto"
        aria-label={`${t("heatmapTitle")} — ${view === "front" ? t("front") : t("back")}`}
      >
        {/* Benen (achter) */}
        <Limb angle={A_LEG} px={PVL_X} py={PVL_Y} sil={LEG} muscles={legMuscles} mir={false} />
        <Limb angle={-A_LEG} px={2 * CX - PVL_X} py={PVL_Y} sil={LEG} muscles={legMuscles} mir />
        {/* Armen */}
        <Limb angle={A_ARM} px={PVA_X} py={PVA_Y} sil={ARM} muscles={armMuscles} mir={false} />
        <Limb angle={-A_ARM} px={2 * CX - PVA_X} py={PVA_Y} sil={ARM} muscles={armMuscles} mir />
        {/* Romp + hoofd (boven) */}
        <g>
          <Sil d={HEAD} />
          <Sil d={mirrorPath(HEAD)} />
          <Sil d={TORSO} />
          <Sil d={mirrorPath(TORSO)} />
          {torsoMuscles.map(([region, d], i) => (
            <path key={`tl-${i}`} d={d} {...paint(region)} />
          ))}
          {torsoMuscles.map(([region, d], i) => (
            <path key={`tr-${i}`} d={mirrorPath(d)} {...paint(region)} />
          ))}
        </g>
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

// --- Silhouet-vormen (linkerhelft) ------------------------------------------

const HEAD =
  "M200,30 C184,30 170,42 164,62 C160,78 161,94 167,108 " +
  "C171,120 179,130 190,135 C194,137 197,138 200,139 Z";

const TORSO =
  "M200,140 C193,140 187,143 184,150 C176,154 166,158 154,166 " +
  "C150,198 152,240 154,290 C158,320 160,348 156,380 " +
  "C152,402 150,422 150,442 C168,450 188,452 200,450 Z";

const ARM =
  "M156,162 C134,160 116,168 108,188 C104,206 106,224 110,240 " +
  "C112,278 114,318 118,352 C121,388 125,428 132,458 " +
  "C135,476 139,496 147,504 C154,508 162,502 161,491 " +
  "C160,470 155,448 152,432 C148,394 146,352 147,318 " +
  "C147,282 149,242 152,210 C153,194 154,178 156,170 " +
  "C156,166 158,162 156,162 Z";

const LEG =
  "M150,436 C136,478 138,542 148,598 C152,620 158,638 165,654 " +
  "C159,688 149,718 148,744 C151,782 160,806 169,822 " +
  "C172,830 172,838 175,844 L207,852 C211,853 211,845 207,838 " +
  "C199,802 196,746 196,694 C196,652 197,590 198,524 " +
  "C199,490 200,464 200,446 C178,442 160,440 150,436 Z";

// --- Spiervormen (linkerhelft; regio → één of meer vormen) ------------------

type Shape = [MuscleRegion, string];

const ARM_FRONT: Shape[] = [
  ["shoulders", "M154,166 C132,163 114,172 108,192 C105,210 110,228 118,240 C132,234 144,222 150,206 C154,194 155,180 154,166 Z"],
  ["biceps", "M150,206 C134,206 120,216 116,238 C113,270 117,308 126,332 C138,328 147,308 149,286 C151,258 151,230 150,206 Z"],
  ["forearms", "M147,336 C133,338 124,352 123,374 C123,410 129,442 140,462 C149,456 152,432 152,410 C152,378 150,356 147,336 Z"],
];

const ARM_BACK: Shape[] = [
  ["shoulders", "M154,166 C132,163 114,172 108,192 C105,210 110,228 118,240 C132,234 144,222 150,206 C154,194 155,180 154,166 Z"],
  ["triceps", "M150,206 C134,206 120,216 116,238 C113,270 117,308 126,332 C138,328 147,308 149,286 C151,258 151,230 150,206 Z"],
  ["forearms", "M147,336 C133,338 124,352 123,374 C123,410 129,442 140,462 C149,456 152,432 152,410 C152,378 150,356 147,336 Z"],
];

const LEG_FRONT: Shape[] = [
  ["quads", "M158,448 C144,454 139,476 141,508 C143,546 153,576 167,588 C173,566 173,532 171,504 C169,476 165,458 158,448 Z"],
  ["quads", "M184,452 C174,456 169,478 170,512 C171,550 178,584 187,602 C195,584 198,546 197,510 C196,480 191,460 184,452 Z"],
  ["quads", "M198,548 C189,552 185,568 186,588 C187,604 192,614 199,618 Z"],
  ["adductors", "M199,466 C190,470 185,488 186,512 C187,548 192,574 199,586 Z"],
  ["calves", "M164,658 C153,664 149,688 151,716 C153,752 160,782 171,796 C176,776 175,742 173,714 C171,690 170,670 164,658 Z"],
  ["calves", "M189,662 C179,666 174,688 175,714 C176,748 183,772 193,782 C197,762 197,728 195,700 C193,680 193,670 189,662 Z"],
];

const LEG_BACK: Shape[] = [
  ["hamstrings", "M160,450 C146,456 141,478 143,510 C145,548 154,580 168,594 C174,572 174,538 172,510 C170,482 166,462 160,450 Z"],
  ["hamstrings", "M186,454 C177,458 173,480 174,512 C175,550 181,582 190,598 C195,580 197,546 196,512 C195,482 191,462 186,454 Z"],
  ["calves", "M164,658 C153,664 149,688 151,716 C153,752 160,782 171,796 C176,776 175,742 173,714 C171,690 170,670 164,658 Z"],
  ["calves", "M189,662 C179,666 174,688 175,714 C176,748 183,772 193,782 C197,762 197,728 195,700 C193,680 193,670 189,662 Z"],
];

const TORSO_FRONT: Shape[] = [
  ["chest", "M199,166 C182,165 164,169 156,180 C151,193 153,214 165,226 C179,233 192,232 199,228 Z"],
  ["traps", "M194,150 C182,153 166,160 153,169 C160,157 173,149 187,145 C191,145 194,147 194,150 Z"],
  ["abs", "M177,238 L196,238 C199,238 199,241 199,243 L199,263 C199,268 196,268 194,268 L177,268 C173,268 172,265 172,262 L172,244 C172,240 174,238 177,238 Z"],
  ["abs", "M177,272 L196,272 C199,272 199,275 199,277 L199,297 C199,302 196,302 194,302 L177,302 C173,302 172,299 172,296 L172,278 C172,274 174,272 177,272 Z"],
  ["abs", "M177,306 L196,306 C199,306 199,309 199,311 L199,331 C199,336 196,336 194,336 L177,336 C173,336 172,333 172,330 L172,312 C172,308 174,306 177,306 Z"],
  ["abs", "M177,340 L196,340 C199,340 199,343 199,345 L199,375 C199,380 196,380 194,380 L177,380 C173,380 172,377 172,374 L172,346 C172,342 174,340 177,340 Z"],
  ["obliques", "M176,236 C166,240 160,254 160,272 C161,292 168,306 178,312 C180,296 180,272 178,254 C177,246 177,240 176,236 Z"],
];

const TORSO_BACK: Shape[] = [
  ["lats", "M160,210 C151,226 150,252 155,282 C161,306 172,322 190,330 C194,314 194,292 190,270 C184,242 173,222 160,210 Z"],
  ["glutes", "M199,396 C183,396 170,407 168,426 C167,448 177,464 194,468 C198,459 200,440 200,418 Z"],
  ["upperBack", "M200,240 C190,242 181,248 177,262 C175,282 182,300 194,310 C197,300 199,282 200,266 Z"],
  ["traps", "M200,148 C188,150 174,157 163,168 C170,190 180,210 191,228 C196,232 199,234 200,234 Z"],
  ["lowerBack", "M200,316 C191,318 185,330 185,350 C185,372 191,390 200,400 Z"],
];
