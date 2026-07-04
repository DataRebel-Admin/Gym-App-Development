import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { OwnerNav, type OwnerNavEntry } from "@/components/nav/owner-nav";
import { SideNavDrawer } from "@/components/nav/side-nav-drawer";
import { UserMenu } from "@/components/nav/user-menu";
import { PageTransition } from "@/components/motion/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { platformMetadata } from "@/lib/metadata";
import { getUserBadge } from "@/lib/account";

// Superadmin werkt platformbreed → titel zonder tenant-suffix (voorkomt o.a. een
// dubbele tenantnaam op /admin/tenants/[id]). Overschrijft de root-template.
export const metadata = platformMetadata;

// Icoon-paden (24x24, stroke) — hergebruikt voor zowel de groep-knoppen als de
// items in het mega-menu / zijmenu.
const ICON_DASHBOARD = "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z";
const ICON_TENANTS =
  "M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M19 21V9h1M9 8h2M9 12h2M9 16h2";
const ICON_USERS =
  "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75";
const ICON_FEATURES =
  "M12 2 4 6v6c0 5 3.5 7.5 8 10 4.5-2.5 8-5 8-10V6l-8-4zM9.5 12l1.8 1.8L15 10";
const ICON_QR =
  "M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3M18 18h3M21 15v6M15 18v3";
const ICON_EMAIL =
  "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM3 7l9 6 9-6";
const ICON_AUDIT =
  "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 13h6M9 17h4";
const ICON_SETTINGS =
  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z";
const ICON_CHANGELOG = "M12 8v4l3 3M3.05 11a9 9 0 1 1 .5 4M3 4v4h4";
const ICON_GROUP_BEHEER = "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5";
const ICON_GROUP_COMMS =
  "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z";
const ICON_GROUP_SYSTEEM =
  "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6";

// Gegroepeerde navigatie (mega-menu i.p.v. een platte, overlopende rij). Dashboard
// blijft een directe link; de rest valt onder uitklapbare categorieën.
const NAV: OwnerNavEntry[] = [
  { type: "link", href: "/admin", label: "Dashboard", iconPath: ICON_DASHBOARD },
  {
    type: "group",
    key: "beheer",
    label: "Beheer",
    iconPath: ICON_GROUP_BEHEER,
    items: [
      { href: "/admin/tenants", label: "Tenants", iconPath: ICON_TENANTS, description: "Sportscholen aanmaken, beheren en huisstijl instellen" },
      { href: "/admin/users", label: "Gebruikers", iconPath: ICON_USERS, description: "Alle gebruikers over tenants heen" },
      { href: "/admin/features", label: "Features", iconPath: ICON_FEATURES, description: "Modules per tenant in- en uitschakelen" },
    ],
  },
  {
    type: "group",
    key: "communicatie",
    label: "Communicatie",
    iconPath: ICON_GROUP_COMMS,
    items: [
      { href: "/admin/email-templates", label: "E-mails", iconPath: ICON_EMAIL, description: "Systeemmails bewerken, previewen en publiceren" },
      { href: "/admin/qr-export", label: "QR-codes", iconPath: ICON_QR, description: "QR-codes voor machines exporteren" },
    ],
  },
  {
    type: "group",
    key: "systeem",
    label: "Systeem",
    iconPath: ICON_GROUP_SYSTEEM,
    items: [
      { href: "/admin/audit", label: "Audit log", iconPath: ICON_AUDIT, description: "Platformbrede activiteit en gebeurtenissen" },
      { href: "/admin/changelog", label: "Wijzigingslogboek", iconPath: ICON_CHANGELOG, description: "Nieuwe functies en verbeteringen in GymRebel" },
      { href: "/admin/settings", label: "Instellingen", iconPath: ICON_SETTINGS, description: "Platforminstellingen en support-contact" },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPERADMIN") redirect("/");

  const badge = await getUserBadge(session.user.id);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface-1/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <SideNavDrawer
              entries={NAV}
              rootHref="/admin"
              brand={{ name: "GymRebel", logoUrl: null }}
              profile={{
                name: badge?.name ?? session.user.name ?? null,
                email: badge?.email ?? session.user.email ?? null,
                image: badge?.image ?? null,
              }}
              className="lg:hidden"
            />
            <Link
              href="/admin"
              className="flex shrink-0 items-center gap-2.5 font-display text-lg font-bold text-neutral-900"
            >
              <span className="flex size-8 items-center justify-center rounded-xl bg-accent-gradient text-sm font-bold text-accent-foreground shadow-accent">
                G
              </span>
              <span>
                GymRebel
                <span className="ml-1.5 rounded-md bg-accent px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                  Platform
                </span>
              </span>
            </Link>
            <div className="hidden lg:block">
              <OwnerNav entries={NAV} rootHref="/admin" />
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
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
