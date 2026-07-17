import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireTenantUser } from "@/lib/staff";
import { prisma } from "@/lib/db";
import { LOCALE_META, isLocale } from "@/lib/i18n/config";
import { StaffDashboard } from "@/components/dashboard/staff-dashboard";
import { getDashboardStats } from "@/lib/insights";
import { getMaintenanceAttentionCount } from "@/lib/maintenance-eval";
import { isFeatureEnabled } from "@/lib/features/service";
import { MaintenanceAlert } from "@/components/maintenance/maintenance-alert";
import { getRecentActivity, serializeAuditRows } from "@/lib/audit-query";
import { normalizeLayout, type WidgetId } from "@/lib/dashboard";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import { Fullscreenable, FullscreenButton } from "@/components/ui/fullscreen";
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

export async function generateMetadata() {
  const t = await getTranslations("owner.dashboard");
  return { title: t("metaTitle") };
}

export default async function OwnerDashboard() {
  const owner = await requireTenantUser();
  const [t, tw, locale] = await Promise.all([
    getTranslations("owner.dashboard"),
    getTranslations("owner.widgets"),
    getLocale(),
  ]);

  // Medewerkers krijgen een op hun rol/permissies afgestemd dashboard
  // (geen audit-/financiële data, geen configureerbare KPI-grid).
  if (owner.role === "TENANT_STAFF") {
    return (
      <StaffDashboard
        tenantId={owner.tenantId}
        coachId={owner.id}
        permissions={owner.permissions}
        name={owner.name}
      />
    );
  }

  // Onderhoudsmodule uit (Superadmin-flag) → geen alert en géén lazy evaluatie.
  const maintenanceEnabled = await isFeatureEnabled(owner.tenantId, "maintenance");
  const [stats, dbUser, recentLogs, maintenanceAttention] = await Promise.all([
    getDashboardStats(owner.tenantId),
    prisma.user.findUnique({
      where: { id: owner.id },
      select: { dashboardLayout: true },
    }),
    getRecentActivity(owner.tenantId, 6),
    maintenanceEnabled
      ? getMaintenanceAttentionCount(owner.tenantId)
      : Promise.resolve(0),
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
  };

  const firstName = owner.name?.split(" ")[0];

  return (
    <Fullscreenable className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Premium hero-header. Ondoorzichtig: achter dit paneel zweeft alleen de
          aurora, dus doorschijnendheid zou de kop enkel onrustig maken. De
          tenant-tint komt van de eigen .bg-aura-laag hieronder. */}
      <section className="panel-sheen relative overflow-hidden rounded-3xl border border-border bg-surface-1 p-7 shadow-lg">
        <div aria-hidden className="bg-aura pointer-events-none absolute inset-0" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-accent">
              {new Date().toLocaleDateString(
                (isLocale(locale) ? LOCALE_META[locale] : LOCALE_META.nl).bcp47,
                { weekday: "long", day: "numeric", month: "long" },
              )}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-neutral-900">
              {firstName ? t("welcomeBackName", { name: firstName }) : t("welcomeBack")}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {stats.activeToday > 0
                ? t("activeToday", { count: stats.activeToday })
                : t("noTrainingToday")}
            </p>
          </div>
          <FullscreenButton />
        </div>
      </section>

      {/* Snelkoppelingen: vaste actiebalk bovenaan i.p.v. verstopt onderin het
          configureerbare grid — de meest gebruikte acties zijn zo meteen bereikbaar. */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900">
          {tw("quickActionsTitle")}
        </h2>
        <QuickActions />
      </section>

      {maintenanceEnabled ? <MaintenanceAlert count={maintenanceAttention} /> : null}

      <WidgetGrid nodes={nodes} initialLayout={layout} />
    </Fullscreenable>
  );
}
