"use client";
import dynamic from "next/dynamic";

/**
 * Lazy, client-only variant van [[MiniBarChart]] — houdt recharts uit de initiële
 * bundel van de member-route die 'm gebruikt. Skeleton-hoogte matcht de default
 * grafiekhoogte (200) zodat er geen layout-shift optreedt.
 */
export const MiniBarChart = dynamic(
  () => import("./mini-bar-chart").then((m) => m.MiniBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] animate-pulse rounded-xl bg-surface-2" aria-hidden />
    ),
  }
);
