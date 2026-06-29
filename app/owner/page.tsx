import type { ReactNode } from "react";
import { requireOwner } from "@/lib/owner";
import { prisma } from "@/lib/db";
import { getDashboardStats } from "@/lib/insights";
import { normalizeLayout, type WidgetId } from "@/lib/dashboard";
import { SectionHeading } from "@/components/ui/section-heading";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import {
  KpiRow,
  UsageList,
  WeekdayChart,
  WeekChart,
  RecentActivity,
  QuickActions,
} from "@/components/dashboard/widget-bodies";

export default async function OwnerDashboard() {
  const owner = await requireOwner();
  const [stats, dbUser] = await Promise.all([
    getDashboardStats(owner.tenantId),
    prisma.user.findUnique({
      where: { id: owner.id },
      select: { dashboardLayout: true },
    }),
  ]);

  const layout = normalizeLayout(dbUser?.dashboardLayout);

  // Server-gerenderde inhoud per widget; de client-grid regelt volgorde,
  // zichtbaarheid en animatie (zie components/dashboard/widget-grid.tsx).
  const nodes: Partial<Record<WidgetId, ReactNode>> = {
    kpis: <KpiRow stats={stats} />,
    "weekday-chart": <WeekdayChart stats={stats} />,
    "week-chart": <WeekChart stats={stats} />,
    "top-machines": <UsageList items={stats.topMachines} />,
    "bottom-machines": <UsageList items={stats.bottomMachines} />,
    "recent-activity": <RecentActivity stats={stats} />,
    "quick-actions": <QuickActions />,
  };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <SectionHeading
        title={`Welkom terug${owner.name ? `, ${owner.name.split(" ")[0]}` : ""}`}
        description="Een overzicht van wat er speelt in jouw sportschool."
      />
      <WidgetGrid nodes={nodes} initialLayout={layout} />
    </div>
  );
}
