import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { OwnerNav, type NavLink } from "@/components/nav/owner-nav";
import { UserMenu } from "@/components/nav/user-menu";
import { PageTransition } from "@/components/motion/page-transition";

const LINKS: NavLink[] = [
  { href: "/owner", label: "Dashboard" },
  { href: "/owner/machines", label: "Machines" },
  { href: "/owner/exercises", label: "Oefeningen" },
  { href: "/owner/schemas", label: "Schema's" },
  { href: "/owner/members", label: "Leden" },
  { href: "/owner/insights", label: "Inzichten" },
  { href: "/owner/rooster", label: "Rooster" },
  { href: "/owner/settings", label: "Instellingen" },
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

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface-1/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6 overflow-x-auto">
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
            <OwnerNav links={LINKS} />
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
