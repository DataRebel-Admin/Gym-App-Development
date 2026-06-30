import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { TopNav, type TopNavLink } from "@/components/nav/top-nav";
import { UserMenu } from "@/components/nav/user-menu";
import { TenantSwitcher } from "@/components/nav/tenant-switcher";
import { getUserTenants } from "@/lib/tenants";
import { PageTransition } from "@/components/motion/page-transition";

const LINKS: TopNavLink[] = [
  { href: "/owner", label: "Dashboard", iconPath: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/owner/machines", label: "Machines", iconPath: "M3 10v4M21 10v4M6 8v8M18 8v8M6 12h12" },
  { href: "/owner/exercises", label: "Oefeningen", iconPath: "M22 12h-4l-3 8L9 4l-3 8H2" },
  { href: "/owner/schemas", label: "Schema's", iconPath: "M8 6h11M8 12h11M8 18h11M3.5 6h.01M3.5 12h.01M3.5 18h.01" },
  { href: "/owner/members", label: "Leden", iconPath: "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/owner/insights", label: "Inzichten", iconPath: "M3 3v18h18M7 15l3-3 3 3 5-6" },
  { href: "/owner/rooster", label: "Rooster", iconPath: "M3 9h18M7 3v4M17 3v4M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" },
  { href: "/owner/audit", label: "Audit log", iconPath: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 13h6M9 17h4" },
  { href: "/owner/settings", label: "Instellingen", iconPath: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
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
  const tenants = session.user.email
    ? await getUserTenants(session.user.email)
    : [];

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface-1/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4 overflow-x-auto">
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
            <TopNav links={LINKS} rootHref="/owner" layoutId="owner-nav-active" />
          </div>
          <UserMenu
            name={session.user.name ?? null}
            email={session.user.email ?? null}
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
