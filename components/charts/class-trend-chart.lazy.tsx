"use client";
import dynamic from "next/dynamic";

/**
 * Lazy, client-only variant van [[ClassTrendChart]] — houdt recharts uit de
 * initiële bundel van /owner/insights. Skeleton-hoogte matcht de default
 * grafiekhoogte (260).
 */
export const ClassTrendChart = dynamic(
  () => import("./class-trend-chart").then((m) => m.ClassTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] animate-pulse rounded-xl bg-surface-2" aria-hidden />
    ),
  }
);
