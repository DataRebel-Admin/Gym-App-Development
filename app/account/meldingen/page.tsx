import { getAccountUser } from "@/lib/account";
import { prisma } from "@/lib/db";
import { vapidPublicKey } from "@/lib/push";
import { getHideQuotes, getHideAchievements, getAllowTrainerPhotos } from "@/lib/user-preferences";
import { NotificationsForm } from "./notifications-form";
import { PushToggle } from "./push-toggle";
import { AchievementHideToggle } from "@/components/achievements/hide-toggle";
import { QuoteHideToggle } from "@/components/account/quote-toggle";
import { PhotoPrivacyToggle } from "@/components/account/photo-privacy-toggle";

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

  return (
    <div className="flex flex-col gap-6">
      <NotificationsForm initial={initial} />
      {isMember ? <PhotoPrivacyToggle initialAllow={getAllowTrainerPhotos(prefs)} /> : null}
      {achievementsEnabled ? <AchievementHideToggle initialHidden={getHideAchievements(prefs)} /> : null}
      {quotesEnabled ? <QuoteHideToggle initialHidden={getHideQuotes(prefs)} /> : null}
      <PushToggle vapidPublicKey={vapidPublicKey()} />
    </div>
  );
}
