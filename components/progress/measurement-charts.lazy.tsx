"use client";
import dynamic from "next/dynamic";

/**
 * Lazy, client-only variant van [[MeasurementCharts]] — houdt recharts uit de
 * initiële bundel van `/member/progress`. Skeleton-hoogte reserveert de
 * metric-kiezer + grafiek (260) om layout-shift te beperken.
 */
export const MeasurementCharts = dynamic(
  () => import("./measurement-charts").then((m) => m.MeasurementCharts),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] animate-pulse rounded-xl bg-surface-2" aria-hidden />
    ),
  }
);
