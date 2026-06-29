import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { LogoutButton } from "@/components/ui/logout-button";
import { MemberNav } from "@/components/nav/member-nav";
import { PageTransition } from "@/components/motion/page-transition";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // Verdediging in de diepte (de middleware beschermt deze routes ook al).
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TENANT_MEMBER") redirect("/owner");

  const tenant = await getCurrentTenant();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col bg-surface-0">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-surface-1/85 px-4 py-3 backdrop-blur">
        <Link
          href="/member"
          className="flex items-center gap-2 font-display font-bold text-neutral-900"
        >
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt=""
              className="h-6 w-6 rounded-md object-contain"
            />
          ) : (
            <span className="flex size-6 items-center justify-center rounded-md bg-accent-gradient text-xs text-accent-foreground">
              {(tenant?.name ?? "G").charAt(0)}
            </span>
          )}
          {tenant?.name ?? "GymRebel"}
        </Link>
        <div className="flex items-center gap-3">
          <span className="max-w-[8rem] truncate text-sm text-neutral-500">
            {session.user.name ?? session.user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="flex flex-1 flex-col pb-24">
        <PageTransition>{children}</PageTransition>
      </main>

      <MemberNav />
    </div>
  );
}
