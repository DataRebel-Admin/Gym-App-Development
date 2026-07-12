"use client";
import dynamic from "next/dynamic";

/**
 * Lazy, client-only variant van de recharts-historiegrafiek. Houdt recharts uit de
 * initiële JS van `/member/history`: de pagina-shell + stats renderen/hydrateren
 * direct, de grafiekchunk streamt daarna in. recharts (`ResponsiveContainer`) rendert
 * server-side toch niets bruikbaars, dus `ssr: false` kost geen zichtbare inhoud.
 */
export const HistoryChart = dynamic(
  () => import("./history-chart").then((m) => m.HistoryChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[264px] animate-pulse rounded-xl bg-surface-2" aria-hidden />
    ),
  }
);
