"use client";
import dynamic from "next/dynamic";

/**
 * Lazy, client-only variant van [[VisitsTrendChart]] — houdt recharts uit de
 * initiële bundel van /owner/insights. Skeleton-hoogte matcht de default
 * grafiekhoogte (260) zodat er geen layout-shift optreedt.
 */
export const VisitsTrendChart = dynamic(
  () => import("./visits-trend-chart").then((m) => m.VisitsTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] animate-pulse rounded-xl bg-surface-2" aria-hidden />
    ),
  }
);
