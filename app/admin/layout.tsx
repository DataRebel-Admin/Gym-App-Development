import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { TopNav, type TopNavLink } from "@/components/nav/top-nav";
import { UserMenu } from "@/components/nav/user-menu";
import { PageTransition } from "@/components/motion/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS: TopNavLink[] = [
  { href: "/admin", label: "Dashboard", iconPath: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/admin/tenants", label: "Tenants", iconPath: "M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M19 21V9h1M9 8h2M9 12h2M9 16h2" },
  { href: "/admin/users", label: "Gebruikers", iconPath: "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/admin/audit", label: "Audit log", iconPath: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 13h6M9 17h4" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPERADMIN") redirect("/");

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface-1/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-5 overflow-hidden">
            <Link
              href="/admin"
              className="flex shrink-0 items-center gap-2.5 font-display text-lg font-bold text-neutral-900"
            >
              <span className="flex size-8 items-center justify-center rounded-xl bg-accent-gradient text-sm font-bold text-accent-foreground shadow-accent">
                G
              </span>
              <span className="hidden sm:inline">
                GymRebel
                <span className="ml-1.5 rounded-md bg-accent px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                  Platform
                </span>
              </span>
            </Link>
            <TopNav links={LINKS} rootHref="/admin" layoutId="admin-nav-active" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <UserMenu
              name={session.user.name ?? null}
              email={session.user.email ?? null}
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
