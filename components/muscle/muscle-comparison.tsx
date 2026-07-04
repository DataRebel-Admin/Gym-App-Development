"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { RegionAnalysis } from "@/lib/muscle-analysis";

/**
 * Vergelijking schema-plan vs. echt getraind — per spiergroep als een compacte
 * "bullet"-balk: de accent-vulling is wat je de laatste 4 weken deed, het streepje
 * is je schema-doel. Bovenaan een ring met de totale therapietrouw (hoeveel van je
 * geplande volume je haalde). Veel duidelijker dan een radar: je ziet direct welke
 * spiergroepen achterblijven en welke je juist extra traint.
 */

type Status = "onTrack" | "behind" | "extra";

function statusOf(plan: number, actual: number): Status {
  if (plan <= 0) return "extra";
  return actual >= plan * 0.9 ? "onTrack" : "behind";
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function MuscleComparison({ regions }: { regions: RegionAnalysis[] }) {
  const t = useTranslations("member.muscles");

  const { rows, scaleMax, pct, tier, planTotal } = useMemo(() => {
    const rows = regions
      .filter((r) => r.planWeekly > 0 || r.actualWeekly > 0)
      .sort(
        (a, b) =>
          Math.max(b.planWeekly, b.actualWeekly) -
          Math.max(a.planWeekly, a.actualWeekly)
      )
      .slice(0, 10)
      .map((r) => ({
        region: r.region,
        label: t(`regions.${r.region}`),
        plan: r.planWeekly,
        actual: r.actualWeekly,
        status: statusOf(r.planWeekly, r.actualWeekly),
      }));

    const scaleMax = Math.max(
      1,
      ...rows.map((r) => Math.max(r.plan, r.actual))
    );

    const planTotal = rows.reduce((s, r) => s + r.plan, 0);
    const covered = rows.reduce(
      (s, r) => s + (r.plan > 0 ? Math.min(r.actual, r.plan) : 0),
      0
    );
    const pct = planTotal > 0 ? Math.round((covered / planTotal) * 100) : 0;
    const tier: "good" | "mid" | "low" =
      pct >= 85 ? "good" : pct >= 50 ? "mid" : "low";

    return { rows, scaleMax, pct, tier, planTotal };
  }, [regions, t]);

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500">
        {t("notEnough")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Totale therapietrouw */}
      {planTotal > 0 && (
        <div className="flex items-center gap-4 rounded-2xl bg-surface-0 p-4">
          <AdherenceRing pct={pct} caption={t("adherenceOfTarget")} />
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-neutral-900">
              {t(`summary.${tier}.title`)}
            </p>
            <p className="mt-0.5 text-sm text-neutral-500">
              {t(`summary.${tier}.hint`)}
            </p>
          </div>
        </div>
      )}

      {/* Per-spiergroep balken */}
      <ul className="flex flex-col gap-3.5">
        {rows.map((r) => {
          const actualPct = clampPct((r.actual / scaleMax) * 100);
          const planPct = clampPct((r.plan / scaleMax) * 100);
          return (
            <li key={r.region}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium text-neutral-800">
                  {r.label}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {r.status === "behind" && (
                    <StatusPill tone="warning">{t("statusBehind")}</StatusPill>
                  )}
                  {r.status === "extra" && (
                    <StatusPill tone="accent">{t("statusExtra")}</StatusPill>
                  )}
                  <span className="text-xs tabular-nums text-neutral-500">
                    {r.plan > 0
                      ? `${fmt(r.actual)} / ${fmt(r.plan)}`
                      : fmt(r.actual)}
                  </span>
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-surface-2">
                {/* Echt getraind */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500"
                  style={{ width: `${actualPct}%` }}
                />
                {/* Schema-doel-marker */}
                {r.plan > 0 && (
                  <div
                    className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-500 ring-2 ring-surface-1"
                    style={{ left: `${planPct}%` }}
                    aria-hidden
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Legenda */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs font-medium text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-full bg-accent" />
          {t("seriesActual")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-[3px] rounded-full bg-neutral-500" />
          {t("legendTarget")}
        </span>
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Ring met het percentage van je geplande volume dat je haalde. */
function AdherenceRing({ pct, caption }: { pct: number; caption: string }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - clampPct(pct) / 100);
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="7"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--tenant-accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-base font-bold leading-none tabular-nums text-neutral-900">
          {pct}%
        </span>
        <span className="mt-0.5 text-[9px] font-medium leading-none text-neutral-500">
          {caption}
        </span>
      </div>
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "warning" | "accent";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        tone === "warning"
          ? "bg-amber-100 text-amber-700"
          : "bg-accent-soft text-accent"
      )}
    >
      {children}
    </span>
  );
}
