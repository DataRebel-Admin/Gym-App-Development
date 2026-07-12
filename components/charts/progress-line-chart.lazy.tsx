"use client";
import dynamic from "next/dynamic";

/**
 * Lazy, client-only variant van [[ProgressLineChart]] — houdt recharts uit de
 * initiële bundel van `/member/history/exercise/[id]`. Skeleton-hoogte (240) matcht
 * de grafiekhoogte zodat er geen layout-shift optreedt.
 */
export const ProgressLineChart = dynamic(
  () => import("./progress-line-chart").then((m) => m.ProgressLineChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[240px] animate-pulse rounded-xl bg-surface-2" aria-hidden />
    ),
  }
);
