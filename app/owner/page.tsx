import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireTenantUser } from "@/lib/staff";
import { prisma } from "@/lib/db";
import { LOCALE_META, isLocale } from "@/lib/i18n/config";
import { StaffDashboard } from "@/components/dashboard/staff-dashboard";
import { getDashboardStats } from "@/lib/insights";
import { getLocationComparison } from "@/lib/metrics/queries";
import { LocationComparisonTable } from "@/components/insights/location-comparison";
import { isMultiLocation } from "@/lib/locations";
import { getMaintenanceAttentionCount } from "@/lib/maintenance-eval";
import { isFeatureEnabled } from "@/lib/features/service";
import { MaintenanceAlert } from "@/components/maintenance/maintenance-alert";
import { FloorActions } from "@/components/owner/floor-actions";
import { getRecentActivity, serializeAuditRows } from "@/lib/audit-query";
import { normalizeLayout, type WidgetId } from "@/lib/dashboard";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import { Reveal, RevealItem } from "@/components/motion/reveal";
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
    // Admin = org-scope (het rol-gebaseerde dashboard voor staff zit hierboven).
    getDashboardStats(owner.tenantId, { kind: "org" }),
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

  // Vestigingsvergelijking-widget: alleen bij een multi-vestiging-organisatie
  // (admin = org-scope; de rollup + het niet-optelbaar-label zitten in de tabel).
  const multiLocation = await isMultiLocation(owner.tenantId);
  const comparison = multiLocation
    ? await getLocationComparison(owner.tenantId, { kind: "org" })
    : null;

  // Server-gerenderde inhoud per widget; de client-grid regelt volgorde,
  // zichtbaarheid en animatie (zie components/dashboard/widget-grid.tsx).
  const nodes: Partial<Record<WidgetId, ReactNode>> = {
    kpis: <KpiRow stats={stats} />,
    ...(comparison ? { "location-comparison": <LocationComparisonTable data={comparison} compact /> } : {}),
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
    // Gestaggerde entree zoals élke ledenpagina die heeft (app/member/page.tsx).
    // De WidgetGrid blijft er bewust buiten: die is een dnd-client-component en
    // heeft z'n eigen animatie.
    <Reveal stagger className="flex flex-col gap-6 px-5 py-7 sm:px-6 sm:py-8">
      {/* Premium hero-header. Ondoorzichtig: achter dit paneel zweeft alleen de
          aurora, dus doorschijnendheid zou de kop enkel onrustig maken. De
          tenant-tint komt van de eigen .bg-aura-laag hieronder. */}
      <RevealItem as="section" className="panel-sheen relative overflow-hidden rounded-3xl border border-border bg-surface-1 p-5 shadow-lg sm:p-7">
        <div aria-hidden className="bg-aura pointer-events-none absolute inset-0" />
        <div className="relative">
          <div>
            <p className="text-sm font-medium text-accent">
              {new Date().toLocaleDateString(
                (isLocale(locale) ? LOCALE_META[locale] : LOCALE_META.nl).bcp47,
                { weekday: "long", day: "numeric", month: "long" },
              )}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              {firstName ? t("welcomeBackName", { name: firstName }) : t("welcomeBack")}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {stats.activeToday > 0
                ? t("activeToday", { count: stats.activeToday })
                : t("noTrainingToday")}
            </p>
          </div>
        </div>
      </RevealItem>

      {/* Telefoon: de handelingen die je in de zaal doet staan bovenaan, binnen
          duimbereik. Op desktop verbergt het blok zichzelf — daar staat de
          volledige navigatie al in beeld. */}
      <FloorActions
        tenantId={owner.tenantId}
        userId={owner.id}
        role={owner.role}
        permissions={owner.permissions}
      />

      {/* Snelkoppelingen: vaste actiebalk bovenaan i.p.v. verstopt onderin het
          configureerbare grid — de meest gebruikte acties zijn zo meteen bereikbaar.
          Op een telefoon is dit de tweede laag onder de vloer-acties. */}
      <RevealItem as="section" className="hidden flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-5 shadow-sm sm:flex">
        <h2 className="text-sm font-semibold text-neutral-900">
          {tw("quickActionsTitle")}
        </h2>
        <QuickActions />
      </RevealItem>

      {maintenanceEnabled ? <MaintenanceAlert count={maintenanceAttention} /> : null}

      <WidgetGrid nodes={nodes} initialLayout={layout} />
    </Reveal>
  );
}
