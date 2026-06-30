import type { ReactNode } from "react";
import { requireOwner } from "@/lib/owner";
import { prisma } from "@/lib/db";
import { getDashboardStats } from "@/lib/insights";
import { getRecentActivity, serializeAuditRows } from "@/lib/audit-query";
import { normalizeLayout, type WidgetId } from "@/lib/dashboard";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import {
  KpiRow,
  UsageList,
  WeekdayChart,
  WeekChart,
  PopularExercises,
  ClassOccupancy,
  RecentActivity,
  QuickActions,
} from "@/components/dashboard/widget-bodies";

export default async function OwnerDashboard() {
  const owner = await requireOwner();
  const [stats, dbUser, recentLogs] = await Promise.all([
    getDashboardStats(owner.tenantId),
    prisma.user.findUnique({
      where: { id: owner.id },
      select: { dashboardLayout: true },
    }),
    getRecentActivity(owner.tenantId, 6),
  ]);

  const layout = normalizeLayout(dbUser?.dashboardLayout);
  const recentActivity = serializeAuditRows(recentLogs);

  // Server-gerenderde inhoud per widget; de client-grid regelt volgorde,
  // zichtbaarheid en animatie (zie components/dashboard/widget-grid.tsx).
  const nodes: Partial<Record<WidgetId, ReactNode>> = {
    kpis: <KpiRow stats={stats} />,
    "week-chart": <WeekChart stats={stats} />,
    "weekday-chart": <WeekdayChart stats={stats} />,
    "popular-exercises": <PopularExercises stats={stats} />,
    "class-occupancy": <ClassOccupancy stats={stats} />,
    "top-machines": <UsageList items={stats.topMachines} />,
    "bottom-machines": <UsageList items={stats.bottomMachines} />,
    "recent-activity": <RecentActivity rows={recentActivity} />,
    "quick-actions": <QuickActions />,
  };

  const firstName = owner.name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      {/* Premium hero-header */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface-1 p-7">
        <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-accent">
              {new Date().toLocaleDateString("nl-NL", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-neutral-900">
              Welkom terug{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {stats.activeToday > 0
                ? `${stats.activeToday} ${stats.activeToday === 1 ? "lid heeft" : "leden hebben"} vandaag al getraind.`
                : "Nog geen trainingen vandaag — tijd om je leden te activeren."}
            </p>
          </div>
        </div>
      </section>

      <WidgetGrid nodes={nodes} initialLayout={layout} />
    </div>
  );
}
