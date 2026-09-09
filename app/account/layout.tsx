import { getTranslations } from "next-intl/server";
import { requireAccount, getUserBadge } from "@/lib/account";
import {
  accountSectionsRaw,
  ACCOUNT_ICON,
  dashboardHrefFor,
  type AccountFlatItem,
} from "@/lib/account-sections";
import { UserMenu } from "@/components/nav/user-menu";
import { AccountNav } from "@/components/account/account-nav";
import { AccountHeaderNav } from "@/components/account/account-header-nav";
import { PageTransition } from "@/components/motion/page-transition";
import { AppLockGate } from "@/components/app-lock/app-lock-gate";
import { ActiveWorkoutBar } from "@/components/member/active-workout-bar";
import { getRunningSessionStart } from "@/lib/session-timeout";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireAccount();
  const badge = await getUserBadge(me.id);
  const t = await getTranslations("account");
  const role = me.role;

  // Loopt er een training? Een lid dat tussendoor z'n instellingen opent moet
  // de "training bezig"-balk (met klok + terugknop) ook hier zien, net als op
  // elke member-pagina. Alleen voor sporters; staff heeft geen sessies.
  const activeStartedAt =
    role === "TENANT_MEMBER" && me.tenantId
      ? await getRunningSessionStart(me.tenantId, me.id)
      : null;

  // Platte lijst voor de desktop-zijbalk (met iconen) én de topbalk-titellookup.
  // "Overzicht" (`/account`) vooraan → terug naar de hub-grid op desktop.
  const flat: AccountFlatItem[] = [
    { href: "/account", label: t("hub.overview"), iconPath: ACCOUNT_ICON.overview },
    ...accountSectionsRaw(role).flatMap((g) =>
      g.items.map((it) => ({
        href: it.href,
        label: t(it.labelKey),
        iconPath: ACCOUNT_ICON[it.icon],
      }))
    ),
  ];

  return (
    <div className="flex min-h-full flex-col">
      {/* Header + "training bezig"-balk plakken samen als één sticky blok (zelfde
          opzet als de member-layout: één wrapper, geen eigen top-offset op de balk). */}
      <div className="sticky top-0 z-40">
        <header className="border-b border-border bg-surface-1/75 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl px-4 py-2 sm:px-6">
            <AccountHeaderNav
              flat={flat}
              rootTitle={t("title")}
              rootHref="/account"
              dashboardHref={dashboardHrefFor(role)}
              backLabel={t("back")}
            >
              <UserMenu
                name={badge?.name ?? me.name ?? null}
                email={badge?.email ?? me.email ?? null}
                image={badge?.image ?? null}
              />
            </AccountHeaderNav>
          </div>
        </header>
        {activeStartedAt ? <ActiveWorkoutBar startedAt={activeStartedAt} /> : null}
      </div>

      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[210px_1fr] lg:gap-8 lg:py-8">
        <aside className="hidden min-w-0 lg:block lg:pt-1">
          <AccountNav items={flat} />
        </aside>
        <main className="min-w-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <AppLockGate />
    </div>
  );
}
