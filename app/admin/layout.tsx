import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { TopNav, type TopNavLink } from "@/components/nav/top-nav";
import { SideNavDrawer } from "@/components/nav/side-nav-drawer";
import type { OwnerNavEntry } from "@/components/nav/owner-nav";
import { UserMenu } from "@/components/nav/user-menu";
import { PageTransition } from "@/components/motion/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { platformMetadata } from "@/lib/metadata";
import { getUserBadge } from "@/lib/account";

// Superadmin werkt platformbreed → titel zonder tenant-suffix (voorkomt o.a. een
// dubbele tenantnaam op /admin/tenants/[id]). Overschrijft de root-template.
export const metadata = platformMetadata;

const LINKS: TopNavLink[] = [
  { href: "/admin", label: "Dashboard", iconPath: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/admin/tenants", label: "Tenants", iconPath: "M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M19 21V9h1M9 8h2M9 12h2M9 16h2" },
  { href: "/admin/users", label: "Gebruikers", iconPath: "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/admin/email-templates", label: "E-mails", iconPath: "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM3 7l9 6 9-6" },
  { href: "/admin/audit", label: "Audit log", iconPath: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 13h6M9 17h4" },
  { href: "/admin/settings", label: "Instellingen", iconPath: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" },
];

// Dezelfde bestemmingen als losse links voor het mobiele zijmenu.
const DRAWER_ENTRIES: OwnerNavEntry[] = LINKS.map((l) => ({
  type: "link",
  href: l.href,
  label: l.label,
  iconPath: l.iconPath,
}));

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
          <div className="flex items-center gap-3 overflow-hidden sm:gap-5">
            <SideNavDrawer
              entries={DRAWER_ENTRIES}
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
              <TopNav links={LINKS} rootHref="/admin" layoutId="admin-nav-active" />
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
