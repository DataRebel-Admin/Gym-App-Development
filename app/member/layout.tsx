import { cookies } from "next/headers";
import Link from "next/link";
import { POST_LOGIN_SPLASH_COOKIE } from "@/lib/constants";
import { PostLoginSplash } from "@/components/post-login-splash";
import { getCurrentTenant } from "@/lib/tenant";
import { areClassesEnabled } from "@/lib/classes";
import { isFeatureEnabled } from "@/lib/features/service";
import { memberSchemaModeFor } from "@/lib/member-schema";
import { hasActiveCoachSchema, requireMember } from "@/lib/member";
import { getMemberMode } from "@/lib/member-mode-server";
import { getUserTenants } from "@/lib/tenants";
import { getUserBadge, hasPasskeys } from "@/lib/account";
import { getNotificationOverview } from "@/lib/notifications";
import { MemberNav } from "@/components/nav/member-nav";
import { MemberDrawer } from "@/components/nav/member-drawer";
import { NotificationBell } from "@/components/nav/notification-bell";
import { PageTransition } from "@/components/motion/page-transition";
import { MemberOnboarding } from "@/components/member/onboarding";
import { PasskeyPrompt } from "@/components/member/passkey-prompt";
import { AppLockPrompt } from "@/components/member/app-lock-prompt";
import { AppLockGate } from "@/components/app-lock/app-lock-gate";
import { ActiveWorkoutBar } from "@/components/member/active-workout-bar";
import { WorkoutOngoingNotification } from "@/components/member/workout-ongoing-notification";
import { getRunningSessionStart } from "@/lib/session-timeout";
import { getAchievementUiState, getPendingCelebrations } from "@/lib/achievements/evaluate";
import { CelebrationOverlay } from "@/components/achievements/celebration-overlay";
import { NativePushRegister } from "@/components/pwa/native-push-register";
import { DeviceCalendarAutosync } from "@/components/calendar/device-calendar-autosync";
import { nativePushConfigured } from "@/lib/push";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Eén gate voor de hele member-area: een lid, of een eigenaar/medewerker met
  // de lid-modus aan (die traint hier op zijn eigen data). Een teamlid zonder
  // die vlag stuurt de guard terug naar /owner.
  const member = await requireMember();
  const { bothModes } = await getMemberMode();

  const tenant = await getCurrentTenant();
  // Effectief = Superadmin-feature-flag én owner-toggle (zie lib/classes.ts).
  const classesEnabled = tenant ? await areClassesEnabled(tenant.id) : true;
  // Drawer-ingang "Agenda" alleen als de ledenagenda-module aan staat.
  const calendarEnabled = tenant ? await isFeatureEnabled(tenant.id, "calendar") : false;
  // Drawer-ingang "Zelf schema samenstellen" alleen als de tenant het aan heeft.
  // (Een meesportend teamlid valt buiten die tenant-instelling — zie
  // memberSchemaModeFor: die gaat over wat de gym haar léden toestaat.)
  const canBuildSchema = tenant
    ? (await memberSchemaModeFor(tenant.id)) !== "DISABLED"
    : false;
  // Drawer-ingang "Aanpassing vragen" alleen als er een coach-schema ligt om aan
  // te passen (een zelfgebouwd schema past het lid zelf aan).
  const canRequestChange = await hasActiveCoachSchema(member.id, member.tenantId);
  const badge = await getUserBadge(member.id);
  // Prompt "inloggen met vingerafdruk?" zolang het account geen passkey heeft.
  const passkeySetUp = await hasPasskeys(member.id);
  const notifications = await getNotificationOverview(member.id);
  const tenants = member.email
    ? await getUserTenants(member.email)
    : [];

  // Celebration-overlay: alleen tonen als trofeeën aan zijn én niet verborgen.
  const achievementUi = await getAchievementUiState(member.id, member.tenantId);
  const celebrations = achievementUi.visible
    ? await getPendingCelebrations(member.id, member.tenantId)
    : [];

  // Vers ingelogd? Dan staat de splash-cookie er en tonen we één keer de
  // gebrande splash (server-side gelezen zodat de overlay al in de SSR-HTML
  // zit; de client verwijdert de cookie na het tonen).
  const showSplash = (await cookies()).has(POST_LOGIN_SPLASH_COOKIE);

  // Loopt er een training? Dan tonen we dat op élke member-pagina in een balk.
  const activeStartedAt = await getRunningSessionStart(
    member.tenantId,
    member.id
  );

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col sm:max-w-lg">
      {/* Header + "training bezig"-balk plakken samen als één sticky blok. Zou de
          balk een eigen top-offset krijgen, dan moest dat getal exact de hoogte
          van de header raken; bij een afwijking schuift de balk er deels onder
          zodra je scrolt en lijkt hij te krimpen.
          De top is de safe area: de body houdt die ruimte vrij voor de
          statusbalk, en met top-0 schoof de header bij scrollen eronder. */}
      <div className="sticky top-[env(safe-area-inset-top)] z-40">
        <header className="flex items-center justify-between gap-2 border-b border-border bg-surface-1/80 px-4 py-3 backdrop-blur-xl">
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
              name={badge?.name ?? member.name ?? null}
              email={badge?.email ?? member.email ?? null}
              image={badge?.image ?? null}
              tenants={tenants}
              currentSlug={tenant?.slug ?? null}
              showAchievements={achievementUi.visible}
              showSchemaBuilder={canBuildSchema}
              showSchemaChange={canRequestChange}
              showCalendar={calendarEnabled}
              showAdminSwitch={bothModes}
            />
          </div>
        </header>

        {activeStartedAt ? <ActiveWorkoutBar startedAt={activeStartedAt} /> : null}
      </div>
      {/* Native app: blijvende "training bezig"-notificatie, gesynct met de
          serverstaat (ook het opruimen ná afronden/annuleren/timeout). */}
      <WorkoutOngoingNotification startedAt={activeStartedAt} />

      <main className="flex flex-1 flex-col pb-24">
        <PageTransition>{children}</PageTransition>
      </main>

      <MemberNav classesEnabled={classesEnabled} />
      <MemberOnboarding />
      {/* Browser: passkey-vraag; native app: app-slot-vraag. De componenten
          sluiten elkaar zelf uit op isNativeApp(). */}
      <PasskeyPrompt userId={member.id} hasPasskey={passkeySetUp} />
      <AppLockPrompt userId={member.id} />
      <AppLockGate />
      <CelebrationOverlay celebrations={celebrations} />
      <NativePushRegister configured={nativePushConfigured()} />
      {/* Android-app: gekoppelde toestelagenda automatisch bijwerken. */}
      {calendarEnabled ? <DeviceCalendarAutosync userId={member.id} /> : null}
      <PostLoginSplash show={showSplash} />
    </div>
  );
}
