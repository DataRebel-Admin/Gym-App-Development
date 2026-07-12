import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { areClassesEnabled } from "@/lib/classes";
import { getUserTenants } from "@/lib/tenants";
import { getUserBadge } from "@/lib/account";
import { getNotificationOverview } from "@/lib/notifications";
import { MemberNav } from "@/components/nav/member-nav";
import { MemberDrawer } from "@/components/nav/member-drawer";
import { NotificationBell } from "@/components/nav/notification-bell";
import { PageTransition } from "@/components/motion/page-transition";
import { MemberOnboarding } from "@/components/member/onboarding";
import { getAchievementUiState, getPendingCelebrations } from "@/lib/achievements/evaluate";
import { CelebrationOverlay } from "@/components/achievements/celebration-overlay";
import { NativePushRegister } from "@/components/pwa/native-push-register";

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
  // Effectief = Superadmin-feature-flag én owner-toggle (zie lib/classes.ts).
  const classesEnabled = tenant ? await areClassesEnabled(tenant.id) : true;
  const badge = await getUserBadge(session.user.id);
  const notifications = await getNotificationOverview(session.user.id);
  const tenants = session.user.email
    ? await getUserTenants(session.user.email)
    : [];

  // Celebration-overlay: alleen tonen als trofeeën aan zijn én niet verborgen.
  const achievementUi = session.user.tenantId
    ? await getAchievementUiState(session.user.id, session.user.tenantId)
    : { visible: false };
  const celebrations = achievementUi.visible
    ? await getPendingCelebrations(session.user.id, session.user.tenantId!)
    : [];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col sm:max-w-lg">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-surface-1/80 px-4 py-3 backdrop-blur-xl">
        <Link
          href="/member"
          className="flex min-w-0 items-center gap-2 font-display font-bold text-neutral-900"
        >
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt=""
              className="h-7 w-7 shrink-0 rounded-md object-contain"
            />
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-gradient text-xs text-accent-foreground">
              {(tenant?.name ?? "G").charAt(0)}
            </span>
          )}
          <span className="truncate">{tenant?.name ?? "GymRebel"}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell
            unreadCount={notifications.unreadCount}
            items={notifications.items}
          />
          <MemberDrawer
            name={badge?.name ?? session.user.name ?? null}
            email={badge?.email ?? session.user.email ?? null}
            image={badge?.image ?? null}
            tenants={tenants}
            currentSlug={tenant?.slug ?? null}
            showAchievements={achievementUi.visible}
          />
        </div>
      </header>

      <main className="flex flex-1 flex-col pb-24">
        <PageTransition>{children}</PageTransition>
      </main>

      <MemberNav classesEnabled={classesEnabled} />
      <MemberOnboarding />
      <CelebrationOverlay celebrations={celebrations} />
      <NativePushRegister />
    </div>
  );
}
