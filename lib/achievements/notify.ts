import "server-only";
import type { Locale, Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { localeFromEnum } from "@/lib/i18n/config";
import { audit } from "@/lib/audit";
import { loadTenantBranding } from "@/lib/email/branding";
import { achievementEarnedMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import { sendPushToUser } from "@/lib/push";
import { prefAllows, createInAppNotification } from "@/lib/notifications";
import { rarityMeta } from "@/lib/achievements/rarity";
import type { AchievementDef } from "@/lib/achievements/definitions";

type Actor = { id?: string | null; email?: string | null; role?: Role | null };

const SYSTEM_ACTOR: Actor = { email: "systeem", role: null };

type NotifyUser = {
  id: string;
  email: string;
  name: string | null;
  notificationPrefs: unknown;
  active: boolean;
  locale: Locale | null;
};

/**
 * Meld een lid dat het één of meer nieuwe trofeeën heeft behaald — over álle
 * toegestane kanalen (in-app / push / e-mail), met respect voor de persoonlijke
 * meldingsvoorkeuren (categorie "achievements"). Best-effort: een verzendfout mag
 * het toekennen nooit breken. In-app: één melding per trofee; push + e-mail:
 * geaggregeerd rond de mooiste (hoogste rariteit) trofee.
 */
export async function notifyAchievementsEarned(opts: {
  tenantId: string;
  user: NotifyUser;
  earned: AchievementDef[];
  origin: string;
  actor?: Actor;
}): Promise<void> {
  const { tenantId, user, earned, origin } = opts;
  const actor = opts.actor ?? SYSTEM_ACTOR;
  if (!user.active || earned.length === 0) return;

  const prefs = user.notificationPrefs;
  const viewUrl = `${origin.replace(/\/$/, "")}/member/trophies`;
  // Mooiste trofee = hoogste rariteit (voor push/e-mail-kop).
  const headline = [...earned].sort(
    (a, b) => rarityMeta(b.rarity).order - rarityMeta(a.rarity).order
  )[0];

  // Alle teksten in de taal van de ontvanger (niet die van de request-context).
  const t = await getTranslations({
    locale: localeFromEnum(user.locale),
    namespace: "achievements",
  });
  const titleOf = (def: AchievementDef) => t(`items.${def.key.replace(/\./g, "_")}.title`);
  const descOf = (def: AchievementDef) => t(`items.${def.key.replace(/\./g, "_")}.description`);
  const channels: string[] = [];

  try {
    if (prefAllows(prefs, "achievements", "inApp")) {
      for (const def of earned) {
        await createInAppNotification({
          userId: user.id,
          tenantId,
          category: "achievements",
          title: t("notify.inAppTitle", { title: titleOf(def) }),
          body: descOf(def),
          link: "/member/trophies",
        });
      }
      channels.push("inApp");
    }

    if (prefAllows(prefs, "achievements", "push")) {
      const body =
        earned.length === 1
          ? titleOf(headline)
          : t("notify.pushMulti", { count: earned.length, title: titleOf(headline) });
      const delivered = await sendPushToUser(user.id, {
        title: t("notify.pushTitle"),
        body,
        url: "/member/trophies",
        tag: "achievement",
      });
      if (delivered > 0) channels.push("push");
    }

    if (prefAllows(prefs, "achievements", "email")) {
      const branding = await loadTenantBranding(tenantId);
      const description =
        earned.length === 1
          ? descOf(headline)
          : t("notify.emailMulti", {
              description: descOf(headline),
              count: earned.length - 1,
            });
      const delivery = await sendEmail({
        to: user.email,
        message: await achievementEarnedMessage({
          branding,
          recipientName: user.name,
          title: titleOf(headline),
          description,
          rarityLabel: t(`rarity.${headline.rarity}`),
          viewUrl,
          locale: user.locale,
        }),
        devLink: viewUrl,
      });
      // Alleen echt bezorgde mail als e-mailkanaal auditen (geen valse claim
      // wanneer er geen transport is geconfigureerd of de killswitch aan staat).
      if (delivery === "sent") channels.push("email");
    }

    if (channels.length > 0) {
      await audit("achievement.notify.sent", {
        actor,
        tenantId,
        targetType: "User",
        targetId: user.id,
        metadata: {
          name: headline.title,
          count: earned.length,
          channels,
          member: user.name ?? user.email,
        },
      });
    }
  } catch (err) {
    console.error("✗ Achievement-melding mislukt:", (err as Error).message);
  }
}
