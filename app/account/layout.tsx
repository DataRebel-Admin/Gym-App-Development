import Link from "next/link";
import { requireAccount } from "@/lib/account";
import { UserMenu } from "@/components/nav/user-menu";
import { AccountNav, type AccountNavItem } from "@/components/account/account-nav";
import { PageTransition } from "@/components/motion/page-transition";

const ICON = {
  profile: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  display: "M12 3a6 6 0 0 0 0 12 6 6 0 0 1 0-12ZM12 3v18M3 12h18",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  privacy: "M12 2 4 5v6c0 5 8 11 8 11s8-6 8-11V5l-8-3ZM9 12l2 2 4-4",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
};

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireAccount();
  const role = me.role;
  const back =
    role === "SUPERADMIN" ? "/admin" : role === "TENANT_ADMIN" ? "/owner" : "/member";

  // Tabs groeien mee terwijl de secties landen.
  const items: AccountNavItem[] = [
    { href: "/account", label: "Profiel", iconPath: ICON.profile },
    { href: "/account/meldingen", label: "Meldingen", iconPath: ICON.bell },
    { href: "/account/privacy", label: "Privacy", iconPath: ICON.privacy },
    { href: "/account/activiteit", label: "Activiteit", iconPath: ICON.activity },
  ];

  return (
    <div className="flex min-h-full flex-col bg-surface-0">
      <header className="sticky top-0 z-40 border-b border-border bg-surface-1/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Link href={back} className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900">
            ← Terug
          </Link>
          <span className="font-display text-base font-bold text-neutral-900">
            Accountinstellingen
          </span>
          <UserMenu name={me.name ?? null} email={me.email ?? null} />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-6 py-8 lg:grid-cols-[210px_1fr]">
        <aside className="lg:pt-1">
          <AccountNav items={items} />
        </aside>
        <main className="min-w-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
