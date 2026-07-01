import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAccount, getUserBadge } from "@/lib/account";
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
  building: "M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M19 21V9h1M9 8h2M9 12h2M9 16h2",
  plug: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
};

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireAccount();
  const badge = await getUserBadge(me.id);
  const t = await getTranslations("account");
  const role = me.role;
  const back =
    role === "SUPERADMIN" ? "/admin" : role === "TENANT_ADMIN" ? "/owner" : "/member";

  // Tabs groeien mee terwijl de secties landen.
  const items: AccountNavItem[] = [
    { href: "/account", label: t("nav.profile"), iconPath: ICON.profile },
    { href: "/account/beveiliging", label: t("nav.security"), iconPath: ICON.shield },
    { href: "/account/meldingen", label: t("nav.notifications"), iconPath: ICON.bell },
    { href: "/account/taal", label: t("language.navLabel"), iconPath: ICON.globe },
    { href: "/account/privacy", label: t("nav.privacy"), iconPath: ICON.privacy },
    { href: "/account/integraties", label: t("nav.integrations"), iconPath: ICON.plug },
    { href: "/account/activiteit", label: t("nav.activity"), iconPath: ICON.activity },
  ];
  if (role === "TENANT_MEMBER") {
    // Sporter-gerichte doelen: alleen voor leden zinvol.
    items.splice(1, 0, { href: "/account/doelen", label: t("nav.goals"), iconPath: ICON.target });
  }
  if (role === "TENANT_ADMIN") {
    items.push({ href: "/account/tenant", label: t("nav.gym"), iconPath: ICON.building });
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface-1/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Link href={back} className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900">
            ← {t("back")}
          </Link>
          <span className="font-display text-base font-bold text-neutral-900">
            {t("title")}
          </span>
          <UserMenu
            name={badge?.name ?? me.name ?? null}
            email={badge?.email ?? me.email ?? null}
            image={badge?.image ?? null}
          />
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
