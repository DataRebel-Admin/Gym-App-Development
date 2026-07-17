import { getAccountUser } from "@/lib/account";
import { prisma } from "@/lib/db";
import { vapidPublicKey } from "@/lib/push";
import { getBackgroundParallax } from "@/lib/background-motion";
import { getHideQuotes, getHideAchievements, getAllowTrainerPhotos, getDisableSetTimers } from "@/lib/user-preferences";
import { NotificationsForm } from "./notifications-form";
import { PushToggle } from "./push-toggle";
import { AchievementHideToggle } from "@/components/achievements/hide-toggle";
import { QuoteHideToggle } from "@/components/account/quote-toggle";
import { PhotoPrivacyToggle } from "@/components/account/photo-privacy-toggle";
import { TimerPreferenceToggle } from "@/components/account/timer-toggle";
import { BackgroundParallaxToggle } from "@/components/account/background-toggle";

export const metadata = { title: "Meldingen" };

export default async function NotificationsPage() {
  const user = await getAccountUser();
  const initial =
    user.notificationPrefs && typeof user.notificationPrefs === "object"
      ? (user.notificationPrefs as Record<string, Record<"email" | "inApp" | "push", boolean>>)
      : null;

  // Trofeeën-opt-out: alleen voor sporters bij een gym met trofeeën aan.
  const details =
    user.role === "TENANT_MEMBER"
      ? await prisma.user.findUnique({
          where: { id: user.id },
          select: { tenant: { select: { achievementsEnabled: true, quotesEnabled: true } } },
        })
      : null;
  const achievementsEnabled = details?.tenant?.achievementsEnabled ?? false;
  const quotesEnabled = details?.tenant?.quotesEnabled ?? false;
  const isMember = user.role === "TENANT_MEMBER";
  const prefs = user.preferences;
  // Achtergrond-parallax geldt app-breed (elke rol) en staat in een cookie.
  const parallaxEnabled = await getBackgroundParallax();

  return (
    <div className="flex flex-col gap-6">
      <NotificationsForm initial={initial} />
      {isMember ? <TimerPreferenceToggle initialDisabled={getDisableSetTimers(prefs)} /> : null}
      {isMember ? <PhotoPrivacyToggle initialAllow={getAllowTrainerPhotos(prefs)} /> : null}
      {achievementsEnabled ? <AchievementHideToggle initialHidden={getHideAchievements(prefs)} /> : null}
      {quotesEnabled ? <QuoteHideToggle initialHidden={getHideQuotes(prefs)} /> : null}
      <BackgroundParallaxToggle initialEnabled={parallaxEnabled} />
      <PushToggle vapidPublicKey={vapidPublicKey()} />
    </div>
  );
}
