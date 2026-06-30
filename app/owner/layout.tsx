import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { OwnerNav, type OwnerNavEntry } from "@/components/nav/owner-nav";
import { UserMenu } from "@/components/nav/user-menu";
import { TenantSwitcher } from "@/components/nav/tenant-switcher";
import { getUserTenants } from "@/lib/tenants";
import { getUserBadge } from "@/lib/account";
import { getNotificationOverview } from "@/lib/notifications";
import { NotificationBell } from "@/components/nav/notification-bell";
import { PageTransition } from "@/components/motion/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";

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
const ICON_AUDIT =
  "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 13h6M9 17h4";

const NAV: OwnerNavEntry[] = [
  {
    type: "link",
    href: "/owner",
    label: "Dashboard",
    iconPath: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  },
  {
    type: "group",
    key: "aanbod",
    label: "Aanbod",
    iconPath: "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6",
    items: [
      { href: "/owner/machines", label: "Machines", iconPath: ICON_MACHINES, description: "Toestellen & QR-codes" },
      { href: "/owner/exercises", label: "Oefeningen", iconPath: ICON_EXERCISES, description: "Catalogus & eigen oefeningen" },
      { href: "/owner/schemas", label: "Schema's", iconPath: ICON_SCHEMAS, description: "Trainingsschema's bouwen & toewijzen" },
    ],
  },
  {
    type: "group",
    key: "leden",
    label: "Leden & rooster",
    iconPath: ICON_MEMBERS,
    items: [
      { href: "/owner/members", label: "Leden", iconPath: ICON_MEMBERS, description: "Ledenbeheer & uitnodigingen" },
      { href: "/owner/rooster", label: "Rooster", iconPath: ICON_ROOSTER, description: "Groepslessen & inschrijvingen" },
    ],
  },
  {
    type: "group",
    key: "analyse",
    label: "Analyse",
    iconPath: ICON_INSIGHTS,
    items: [
      { href: "/owner/insights", label: "Inzichten", iconPath: ICON_INSIGHTS, description: "Statistieken & trends" },
      { href: "/owner/audit", label: "Audit log", iconPath: ICON_AUDIT, description: "Activiteitenlogboek" },
    ],
  },
  {
    type: "link",
    href: "/owner/settings",
    label: "Instellingen",
    iconPath: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  },
];

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TENANT_ADMIN") redirect("/member");

  const tenant = await getCurrentTenant();
  const badge = await getUserBadge(session.user.id);
  const notifications = await getNotificationOverview(session.user.id);
  const tenants = session.user.email
    ? await getUserTenants(session.user.email)
    : [];

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface-1/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/owner"
              className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-neutral-900"
            >
              {tenant?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tenant.logoUrl}
                  alt=""
                  className="h-7 w-7 rounded-md object-contain"
                />
              ) : (
                <span className="flex size-7 items-center justify-center rounded-md bg-accent-gradient text-sm text-accent-foreground">
                  {(tenant?.name ?? "G").charAt(0)}
                </span>
              )}
              {tenant?.name ?? "GymRebel"}
            </Link>
            <TenantSwitcher tenants={tenants} currentSlug={tenant?.slug ?? null} />
            <OwnerNav entries={NAV} rootHref="/owner" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NotificationBell
              unreadCount={notifications.unreadCount}
              items={notifications.items}
            />
            <ThemeToggle />
            <UserMenu
              name={badge?.name ?? session.user.name ?? null}
              email={badge?.email ?? session.user.email ?? null}
              image={badge?.image ?? null}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
