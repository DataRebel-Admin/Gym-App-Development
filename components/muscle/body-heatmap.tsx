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
 * Body-heatmap: een anatomisch voor-/achteraanzicht waarin elke spiergroep
 * gekleurd wordt op basis van het wekelijkse set-volume dat het schema eraan
 * besteedt (zie lib/muscle-map.ts). Tikken op een spier toont het detail.
 *
 * Het figuur is opgebouwd uit contour-paths per spier (delts, pecs, 6-pack,
 * quad-koppen, kuiten, …); de rechterhelft is een `scale(-1 1)`-spiegeling om de
 * middenas (x=200), dus altijd symmetrisch. Eén spiergroep kan uit meerdere
 * vormen bestaan (bv. quads = 3 koppen) — ze delen dezelfde regio/kleur/klik.
 */

const CX = 200;

/** Spiegel een absoluut M/L/C/Z-pad om x=CX (voor de rechterlichaamshelft). */
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

  /** Render een spiervorm + zijn spiegeling; beide klikbaar op dezelfde regio. */
  const Muscle = ({ region, d }: { region: MuscleRegion; d: string }) => {
    const props = {
      fill: MUSCLE_LEVEL_COLOR[levelOf(region)],
      onClick: () => setSelected((cur) => (cur === region ? null : region)),
      className: "cursor-pointer transition-[fill,stroke] duration-500",
      stroke: selected === region ? "var(--neutral-900)" : "var(--surface-1)",
      strokeWidth: selected === region ? 2.5 : 1,
      role: "button" as const,
      "aria-label": t(`regions.${region}`),
    };
    return (
      <>
        <path d={d} {...props} />
        <path d={mirrorPath(d)} {...props} />
      </>
    );
  };

  const shapes = view === "front" ? FRONT_SHAPES : BACK_SHAPES;
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
        viewBox="0 0 400 900"
        className="mx-auto h-[420px] w-auto"
        aria-label={`${t("heatmapTitle")} — ${view === "front" ? t("front") : t("back")}`}
      >
        <BaseBody />
        {shapes.map(([region, d], i) => (
          <Muscle key={`${view}-${i}`} region={region} d={d} />
        ))}
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

// --- Silhouet (grijze basis; linkerhelft + spiegeling) ----------------------

const TORSO =
  "M200,32 C174,32 156,52 156,78 C156,104 174,122 190,126 " +
  "C188,134 186,140 184,148 C176,152 166,156 154,164 " +
  "C150,196 152,238 154,288 C158,318 160,346 156,378 " +
  "C152,400 150,420 150,440 C168,448 188,450 200,448 Z";

const ARM =
  "M156,162 C134,160 116,168 108,188 C104,206 106,224 110,240 " +
  "C112,278 114,318 118,352 C121,388 125,428 132,458 " +
  "C135,476 139,496 147,504 C154,508 162,502 161,491 " +
  "C160,470 155,448 152,432 C148,394 146,352 147,318 " +
  "C147,282 149,242 152,210 C153,194 154,178 156,170 " +
  "C156,166 158,162 156,162 Z";

const LEG =
  "M150,436 C140,478 142,540 150,596 C154,618 160,636 166,652 " +
  "C161,686 152,716 151,742 C154,780 162,804 170,820 " +
  "C173,828 173,836 176,842 L206,850 C210,851 210,843 206,836 " +
  "C198,800 195,744 195,692 C195,650 197,588 198,522 " +
  "C199,488 200,462 200,444 C180,440 162,438 150,436 Z";

function BaseBody() {
  return (
    <g className="fill-neutral-200">
      <circle cx={CX} cy={78} r={46} />
      <path d={ARM} />
      <path d={mirrorPath(ARM)} />
      <path d={LEG} />
      <path d={mirrorPath(LEG)} />
      <path d={TORSO} />
      <path d={mirrorPath(TORSO)} />
    </g>
  );
}

// --- Spiervormen (linkerhelft; regio → één of meer vormen) ------------------

type Shape = [MuscleRegion, string];

const FRONT_SHAPES: Shape[] = [
  ["shoulders", "M154,166 C132,163 114,172 108,192 C105,210 110,228 118,240 C132,234 144,222 150,206 C154,194 155,180 154,166 Z"],
  ["chest", "M199,166 C182,165 164,169 156,180 C151,193 153,214 165,226 C179,233 192,232 199,228 Z"],
  ["biceps", "M150,206 C134,206 120,216 116,238 C113,270 117,308 126,332 C138,328 147,308 149,286 C151,258 151,230 150,206 Z"],
  ["forearms", "M147,336 C133,338 124,352 123,374 C123,410 129,442 140,462 C149,456 152,432 152,410 C152,378 150,356 147,336 Z"],
  ["traps", "M194,150 C182,153 166,160 153,169 C160,157 173,149 187,145 C191,145 194,147 194,150 Z"],
  ["abs", "M177,238 L196,238 C199,238 199,241 199,243 L199,263 C199,268 196,268 194,268 L177,268 C173,268 172,265 172,262 L172,244 C172,240 174,238 177,238 Z"],
  ["abs", "M177,272 L196,272 C199,272 199,275 199,277 L199,297 C199,302 196,302 194,302 L177,302 C173,302 172,299 172,296 L172,278 C172,274 174,272 177,272 Z"],
  ["abs", "M177,306 L196,306 C199,306 199,309 199,311 L199,331 C199,336 196,336 194,336 L177,336 C173,336 172,333 172,330 L172,312 C172,308 174,306 177,306 Z"],
  ["abs", "M177,340 L196,340 C199,340 199,343 199,345 L199,375 C199,380 196,380 194,380 L177,380 C173,380 172,377 172,374 L172,346 C172,342 174,340 177,340 Z"],
  ["obliques", "M176,236 C166,240 160,254 160,272 C161,292 168,306 178,312 C180,296 180,272 178,254 C177,246 177,240 176,236 Z"],
  ["quads", "M160,450 C148,456 143,476 145,506 C147,542 156,572 168,584 C173,562 173,530 171,504 C169,478 166,460 160,450 Z"],
  ["quads", "M184,454 C175,458 171,478 172,510 C173,548 179,582 187,600 C194,582 197,546 196,512 C195,482 191,462 184,454 Z"],
  ["quads", "M198,546 C190,550 186,566 187,586 C188,602 193,612 199,616 Z"],
  ["adductors", "M199,466 C191,470 186,488 187,512 C188,546 193,572 199,584 Z"],
  ["calves", "M164,660 C154,666 150,688 152,714 C154,750 161,780 171,794 C175,774 174,742 172,714 C170,690 169,672 164,660 Z"],
  ["calves", "M188,664 C179,668 175,688 176,712 C177,744 184,768 193,778 C197,758 197,724 195,698 C193,678 192,670 188,664 Z"],
];

const BACK_SHAPES: Shape[] = [
  ["shoulders", "M154,166 C132,163 114,172 108,192 C105,210 110,228 118,240 C132,234 144,222 150,206 C154,194 155,180 154,166 Z"],
  ["triceps", "M150,206 C134,206 120,216 116,238 C113,270 117,308 126,332 C138,328 147,308 149,286 C151,258 151,230 150,206 Z"],
  ["forearms", "M147,336 C133,338 124,352 123,374 C123,410 129,442 140,462 C149,456 152,432 152,410 C152,378 150,356 147,336 Z"],
  ["lats", "M160,210 C151,226 150,252 155,282 C161,306 172,322 190,330 C194,314 194,292 190,270 C184,242 173,222 160,210 Z"],
  ["glutes", "M198,398 C184,398 172,408 170,426 C169,446 178,462 194,466 C198,458 200,440 200,420 Z"],
  ["hamstrings", "M162,452 C150,458 145,480 147,512 C149,550 158,584 170,598 C175,576 175,540 173,512 C171,484 168,462 162,452 Z"],
  ["hamstrings", "M186,456 C178,460 174,482 175,514 C176,552 182,584 190,600 C195,582 197,548 196,514 C195,484 191,464 186,456 Z"],
  ["calves", "M162,660 C153,666 150,688 152,716 C154,750 161,776 170,788 C174,768 173,740 171,714 C169,690 168,672 162,660 Z"],
  ["calves", "M188,662 C179,666 175,688 176,714 C177,748 184,772 192,784 C196,764 196,732 194,704 C192,682 192,672 188,662 Z"],
  ["upperBack", "M200,240 C190,242 181,248 177,262 C175,282 182,300 194,310 C197,300 199,282 200,266 Z"],
  ["traps", "M200,148 C188,150 174,157 163,168 C170,190 180,210 191,228 C196,232 199,234 200,234 Z"],
  ["lowerBack", "M200,316 C191,318 185,330 185,350 C185,372 191,390 200,400 Z"],
];
