import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { POST_LOGIN_SPLASH_COOKIE } from "@/lib/constants";
import { PostLoginSplash } from "@/components/post-login-splash";
import { requireTenantUser } from "@/lib/staff";
import { getCurrentTenant } from "@/lib/tenant";
import { areClassesEnabled } from "@/lib/classes";
import { isFeatureEnabled } from "@/lib/features/service";
import { Badge } from "@/components/ui/badge";
import { OwnerNav, type OwnerNavEntry } from "@/components/nav/owner-nav";
import { SideNavDrawer } from "@/components/nav/side-nav-drawer";
import { MobileNavProvider } from "@/components/nav/mobile-nav-provider";
import { OwnerBottomNav, type OwnerTab } from "@/components/nav/owner-bottom-nav";
import { UserMenu } from "@/components/nav/user-menu";
import { TenantSwitcher } from "@/components/nav/tenant-switcher";
import { getUserTenants } from "@/lib/tenants";
import { getUserBadge } from "@/lib/account";
import { getNotificationOverview } from "@/lib/notifications";
import { NotificationBell } from "@/components/nav/notification-bell";
import { PageTransition } from "@/components/motion/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { NativePushRegister } from "@/components/pwa/native-push-register";
import { AppLockGate } from "@/components/app-lock/app-lock-gate";
import { ActiveWorkoutBar } from "@/components/member/active-workout-bar";
import { getRunningSessionStart } from "@/lib/session-timeout";
import { getMemberMode } from "@/lib/member-mode-server";
import { nativePushConfigured } from "@/lib/push";

// Geen platte, scrollende rij meer: de bestemmingen zijn gegroepeerd in
// categorieën die uitklappen in een mega-menu. Dashboard en Instellingen
// blijven directe links (meest gebruikte bestemmingen).
const ICON_MACHINES = "M3 10v4M21 10v4M6 8v8M18 8v8M6 12h12";
const ICON_EXERCISES = "M22 12h-4l-3 8L9 4l-3 8H2";
const ICON_SCHEMAS = "M8 6h11M8 12h11M8 18h11M3.5 6h.01M3.5 12h.01M3.5 18h.01";
const ICON_MEMBERS =
  "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75";
const ICON_ROOSTER =
  "M3 9h18M7 3v4M17 3v4M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z";
const ICON_INSIGHTS = "M3 3v18h18M7 15l3-3 3 3 5-6";
const ICON_REQUESTS =
  "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z";
const ICON_AUDIT =
  "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 13h6M9 17h4";
const ICON_STAFF =
  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6";
const ICON_LOCATIONS =
  "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6";
const ICON_ENGAGEMENT =
  "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z";
const ICON_MAINTENANCE =
  "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2-2 2.7-2.7Z";
const ICON_CHANGELOG =
  "M12 8v4l3 3M3.05 11a9 9 0 1 1 .5 4M3 4v4h4";

type NavTranslator = Awaited<ReturnType<typeof getTranslations<"nav.owner">>>;

function buildNav(t: NavTranslator): OwnerNavEntry[] {
  return [
    {
      type: "link",
      href: "/owner",
      label: t("dashboard"),
      iconPath: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    },
    {
      type: "group",
      key: "aanbod",
      label: t("offer"),
      iconPath: "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6",
      items: [
        { href: "/owner/machines", label: t("machines"), iconPath: ICON_MACHINES, description: t("machinesDesc"), permission: "machines:qr-export" },
        { href: "/owner/exercises", label: t("exercises"), iconPath: ICON_EXERCISES, description: t("exercisesDesc"), permission: "exercises:manage" },
        { href: "/owner/schemas", label: t("schemas"), iconPath: ICON_SCHEMAS, description: t("schemasDesc"), permission: "schemas:manage" },
        { href: "/owner/maintenance", label: t("maintenance"), iconPath: ICON_MAINTENANCE, description: t("maintenanceDesc"), permission: "maintenance:manage" },
        { href: "/owner/defects", label: t("defects"), iconPath: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z", description: t("defectsDesc"), permission: "defects:manage" },
      ],
    },
    {
      type: "group",
      key: "leden",
      label: t("membersRooster"),
      iconPath: ICON_MEMBERS,
      items: [
        { href: "/owner/members", label: t("members"), iconPath: ICON_MEMBERS, description: t("membersDesc"), permission: "members:view" },
        { href: "/owner/staff", label: t("staff"), iconPath: ICON_STAFF, description: t("staffDesc"), adminOnly: true },
        { href: "/owner/locations", label: "Vestigingen", iconPath: ICON_LOCATIONS, description: "Beheer de fysieke locaties van je organisatie", adminOnly: true },
        { href: "/owner/requests", label: t("requests"), iconPath: ICON_REQUESTS, description: t("requestsDesc"), permission: "schemas:manage" },
        { href: "/owner/engagement", label: t("engagement"), iconPath: ICON_ENGAGEMENT, description: t("engagementDesc"), permission: "members:view" },
        { href: "/owner/rooster", label: t("rooster"), iconPath: ICON_ROOSTER, description: t("roosterDesc"), permission: "schedule:manage" },
      ],
    },
    {
      type: "group",
      key: "analyse",
      label: t("analysis"),
      iconPath: ICON_INSIGHTS,
      items: [
        { href: "/owner/insights", label: t("insights"), iconPath: ICON_INSIGHTS, description: t("insightsDesc"), permission: "analytics:view" },
        { href: "/owner/audit", label: t("audit"), iconPath: ICON_AUDIT, description: t("auditDesc"), adminOnly: true },
        { href: "/owner/changelog", label: t("changelog"), iconPath: ICON_CHANGELOG, description: t("changelogDesc"), adminOnly: true },
      ],
    },
    {
      type: "link",
      href: "/owner/settings",
      label: t("settings"),
      iconPath: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
      adminOnly: true,
    },
  ];
}

/**
 * Filtert de navigatie op de effectieve permissies van de gebruiker. De eigenaar
 * ziet alles; een medewerker ziet alleen niet-gegate items + items waarvoor 'ie de
 * permissie heeft. `adminOnly`-items blijven exclusief voor de eigenaar. Lege
 * groepen vallen weg (geen verborgen-functionaliteit-fouten).
 */
function filterNav(
  entries: OwnerNavEntry[],
  isAdmin: boolean,
  permissions: Set<string>,
  disabledHrefs: Set<string>
): OwnerNavEntry[] {
  const allowed = (g: { permission?: string; adminOnly?: boolean }) =>
    g.adminOnly ? isAdmin : g.permission ? isAdmin || permissions.has(g.permission) : true;
  // Uitgeschakelde modules (feature-flags per tenant) → verberg hun ingangen.
  const featureOk = (href?: string) => !href || !disabledHrefs.has(href);
  return entries.flatMap<OwnerNavEntry>((entry) => {
    if (entry.type === "link") return allowed(entry) && featureOk(entry.href) ? [entry] : [];
    const items = entry.items.filter((i) => allowed(i) && featureOk(i.href));
    return items.length ? [{ ...entry, items }] : [];
  });
}

/**
 * De vijf tabs van de mobiele onderbalk, afgeleid uit de **al gefilterde**
 * navigatie: eerst de vaste voorkeursvolgorde, daarna aangevuld met de eerste
 * bestemmingen die deze gebruiker wél mag zien. Zo staat de balk ook vol voor een
 * medewerker die bijvoorbeeld alleen defecten en onderhoud beheert, en verschijnt
 * er nooit een tab naar een pagina waar hij een 403 op krijgt.
 */
const BOTTOM_NAV_PREFERRED = [
  "/owner",
  "/owner/members",
  "/owner/schemas",
  "/owner/rooster",
];
const BOTTOM_NAV_TABS = 4; // + "Meer" = 5 knoppen

function pickBottomTabs(entries: OwnerNavEntry[]): OwnerTab[] {
  const flat = entries.flatMap<OwnerTab>((entry) =>
    entry.type === "link"
      ? [{ href: entry.href, label: entry.label, iconPath: entry.iconPath ?? "" }]
      : entry.items.map((i) => ({
          href: i.href,
          label: i.label,
          iconPath: i.iconPath ?? "",
        }))
  );
  const byHref = new Map(flat.map((t) => [t.href, t]));
  const picked: OwnerTab[] = [];
  for (const href of BOTTOM_NAV_PREFERRED) {
    const tab = byHref.get(href);
    if (tab) picked.push(tab);
  }
  for (const tab of flat) {
    if (picked.length >= BOTTOM_NAV_TABS) break;
    if (!picked.some((p) => p.href === tab.href)) picked.push(tab);
  }
  return picked.slice(0, BOTTOM_NAV_TABS);
}

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireTenantUser();
  const isAdmin = user.role === "TENANT_ADMIN";

  const tNav = await getTranslations("nav.owner");
  const tenant = await getCurrentTenant();

  // Verberg de ingangen van uitgeschakelde modules (Superadmin feature-flags).
  const disabledHrefs = new Set<string>();
  if (tenant) {
    const [classesOk, maintenanceOk, defectsOk] = await Promise.all([
      areClassesEnabled(tenant.id),
      isFeatureEnabled(tenant.id, "maintenance"),
      isFeatureEnabled(tenant.id, "defects"),
    ]);
    if (!classesOk) disabledHrefs.add("/owner/rooster");
    if (!maintenanceOk) disabledHrefs.add("/owner/maintenance");
    if (!defectsOk) disabledHrefs.add("/owner/defects");
  }

  const NAV = filterNav(
    buildNav(tNav),
    isAdmin,
    user.permissions as Set<string>,
    disabledHrefs
  );

  const bottomTabs = pickBottomTabs(NAV);

  // Sport deze eigenaar/medewerker hier zelf ook? Dan hoort de "training
  // bezig"-balk ook in de beheeromgeving (zelfde afweging als de account-layout
  // en de publieke QR-pagina: één tik terug naar de lopende training).
  const { bothModes } = await getMemberMode();
  const activeStartedAt = bothModes
    ? await getRunningSessionStart(user.tenantId, user.id)
    : null;

  const badge = await getUserBadge(user.id);
  const notifications = await getNotificationOverview(user.id);
  const tenants = user.email ? await getUserTenants(user.email) : [];
  // Vers ingelogd? Dan staat de splash-cookie er en tonen we één keer de
  // gebrande splash (server-side gelezen zodat de overlay al in de SSR-HTML
  // zit; de client verwijdert de cookie na het tonen).
  const showSplash = (await cookies()).has(POST_LOGIN_SPLASH_COOKIE);

  // "Contact opnemen"-gegevens (auto-fill). De server-action leidt de echte
  // waarden opnieuw af — dit is puur voor de UX (read-only tonen).
  const support = {
    name: badge?.name ?? user.name ?? "",
    email: badge?.email ?? user.email ?? "",
    gymName: tenant?.name ?? "GymRebel",
  };

  return (
    <MobileNavProvider>
      <div className="flex min-h-full flex-col">
        {/* Header + "training bezig"-balk plakken samen als één sticky blok (zelfde
            opzet als de member-layout: één wrapper, geen eigen top-offset op de balk).
            .glass i.p.v. een eigen alpha: content schuift hier écht onderdoor, dus
            het glas blijft — maar de dekking is centraal geregeld (--glass) zodat
            de bewegende aurora de navigatie niet doorkleurt. */}
        <div className="sticky top-0 z-40">
          <header className="glass border-b border-border">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3 lg:gap-4">
                {/* Logo + naam; bij meerdere sportscholen is de naam zelf de
                    switcher (zie TenantSwitcher) — geen losse knop in de nav-rij. */}
                <TenantSwitcher
                  tenants={tenants}
                  currentSlug={tenant?.slug ?? null}
                  name={tenant?.name ?? "GymRebel"}
                  logoUrl={tenant?.logoUrl ?? null}
                  homeHref="/owner"
                />
                {/* De rolbadge verdwijnt op de krappe lg-breedte (nav + belknop
                    strijden daar om elke pixel) en komt op xl terug. */}
                <span className="hidden shrink-0 sm:inline-flex lg:hidden xl:inline-flex">
                  <Badge tone={isAdmin ? "accent" : "neutral"}>
                    {isAdmin ? tNav("roleOwner") : tNav("roleStaff")}
                  </Badge>
                </span>
                <div className="hidden min-w-0 items-center lg:flex">
                  <OwnerNav entries={NAV} rootHref="/owner" />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <NotificationBell
                  unreadCount={notifications.unreadCount}
                  items={notifications.items}
                />
                <div className="hidden items-center gap-2 lg:flex">
                  <ThemeToggle />
                  <UserMenu
                    name={badge?.name ?? user.name ?? null}
                    email={badge?.email ?? user.email ?? null}
                    image={badge?.image ?? null}
                    support={support}
                    compact
                    showTrainSwitch={bothModes}
                  />
                </div>
                <SideNavDrawer
                  entries={NAV}
                  rootHref="/owner"
                  brand={{ name: tenant?.name ?? "GymRebel", logoUrl: tenant?.logoUrl ?? null }}
                  profile={{
                    name: badge?.name ?? user.name ?? null,
                    email: badge?.email ?? user.email ?? null,
                    image: badge?.image ?? null,
                  }}
                  tenants={tenants}
                  currentSlug={tenant?.slug ?? null}
                  support={support}
                  showTrainSwitch={bothModes}
                  side="right"
                  className="lg:hidden"
                />
              </div>
            </div>
          </header>
          {activeStartedAt ? <ActiveWorkoutBar startedAt={activeStartedAt} /> : null}
        </div>
        {/* pb-24 op mobiel: ruimte voor de onderbalk (lg+ heeft die niet). */}
        <main className="mx-auto w-full max-w-7xl flex-1 pb-24 lg:pb-0">
          <PageTransition>{children}</PageTransition>
        </main>
        <OwnerBottomNav
          tabs={bottomTabs}
          rootHref="/owner"
          moreLabel={tNav("more")}
        />
        <NativePushRegister configured={nativePushConfigured()} />
        <AppLockGate />
        <PostLoginSplash show={showSplash} />
      </div>
    </MobileNavProvider>
  );
}
