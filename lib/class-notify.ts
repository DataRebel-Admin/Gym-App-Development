import "server-only";
import type { Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { localeFromEnum, type AppLocale } from "@/lib/i18n/config";
import { audit } from "@/lib/audit";
import { loadTenantBranding } from "@/lib/email/branding";
import { classNotificationMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import { sendPushToUser } from "@/lib/push";
import { prefAllows, createInAppNotification } from "@/lib/notifications";
import { appBaseUrl } from "@/lib/app-url";
import { formatSessionStart, formatTimeRange } from "@/lib/datetime";

export type ClassNotifyActor = { id?: string | null; email?: string | null; role?: Role | null };
const SYSTEM_ACTOR: ClassNotifyActor = { email: "systeem", role: null };

/**
 * Soorten les-meldingen aan **leden** (categorie `classes`):
 * - enrolled / waitlisted: bevestiging van de eigen aanmelding
 * - promoted: van de wachtlijst doorgeschoven naar een plek
 * - moved: tijd/vestiging gewijzigd door de sportschool
 * - cancelled: sessie (of hele les) verwijderd
 * - reminder: cron, kort vóór de les
 */
export type ClassNotifyKind =
  | "enrolled"
  | "waitlisted"
  | "promoted"
  | "moved"
  | "cancelled"
  | "reminder";

/**
 * De sessie wordt **expliciet** meegegeven (niet via id geladen): bij een
 * annulering bestaat de rij al niet meer als de melding verstuurd wordt.
 */
export type ClassSessionInfo = {
  id: string;
  className: string;
  startsAt: Date;
  endsAt: Date;
  /** IANA-tijdzone van de vestiging: de les-klok, niet de serverklok. */
  timezone: string;
};

function whenText(s: { startsAt: Date; endsAt: Date }, tz: string): string {
  return `${formatSessionStart(s.startsAt, tz)} (${formatTimeRange(s.startsAt, s.endsAt, tz)})`;
}

/**
 * Meld een groep leden iets over een les-sessie, over alle toegestane kanalen
 * (in-app / push / e-mail) met respect voor de voorkeuren (categorie
 * `classes`). Best-effort: faalt nooit hard, breekt de veroorzakende actie
 * nooit. Eén auditregel per aanroep (`class.notify.sent`), geen ruis per lid.
 */
export async function notifyClassEvent(opts: {
  tenantId: string;
  kind: ClassNotifyKind;
  session: ClassSessionInfo;
  userIds: string[];
  /** Bij `moved`: de vorige tijd (voor "was …"). */
  previous?: { startsAt: Date; endsAt: Date } | null;
  actor?: ClassNotifyActor;
}): Promise<number> {
  const { tenantId, kind, session } = opts;
  const userIds = [...new Set(opts.userIds)];
  if (userIds.length === 0) return 0;
  const actor = opts.actor ?? SYSTEM_ACTOR;

  let branding;
  let users;
  try {
    [branding, users] = await Promise.all([
      loadTenantBranding(tenantId),
      prisma.user.findMany({
        where: { id: { in: userIds }, tenantId, active: true, archivedAt: null },
        select: { id: true, email: true, name: true, notificationPrefs: true, locale: true },
      }),
    ]);
  } catch (err) {
    console.error("✗ Les-meldingen ophalen mislukt:", (err as Error).message);
    return 0;
  }

  const link = "/member/rooster";
  const viewUrl = `${appBaseUrl()}${link}`;
  const tz = session.timezone;
  const when = whenText(session, tz);
  const previous = opts.previous ? whenText(opts.previous, tz) : "";

  // Translator per taal hergebruiken (patroon lib/staff-notify.ts).
  const trCache = new Map<AppLocale, Awaited<ReturnType<typeof getTranslations>>>();
  const trFor = async (loc: AppLocale) => {
    const cached = trCache.get(loc);
    if (cached) return cached;
    const t = await getTranslations({ locale: loc, namespace: "notifications.classes" });
    trCache.set(loc, t);
    return t;
  };

  let notified = 0;
  for (const u of users) {
    const prefs = u.notificationPrefs;
    try {
      const t = await trFor(localeFromEnum(u.locale));
      const vars = { name: session.className, when, previous };
      const title = t(`${kind}Title`, vars);
      const body = t(`${kind}Body`, vars);
      let any = false;

      if (prefAllows(prefs, "classes", "inApp")) {
        await createInAppNotification({
          userId: u.id,
          tenantId,
          category: "classes",
          title,
          body,
          link,
        });
        any = true;
      }
      if (prefAllows(prefs, "classes", "push")) {
        const delivered = await sendPushToUser(u.id, {
          title,
          body,
          url: link,
          tag: `class-${session.id}`,
          category: "classes",
        });
        if (delivered > 0) any = true;
      }
      if (prefAllows(prefs, "classes", "email")) {
        const delivery = await sendEmail({
          to: u.email,
          message: await classNotificationMessage({
            branding,
            recipientName: u.name,
            headline: title,
            intro: body,
            viewUrl,
            locale: u.locale,
          }),
        });
        if (delivery === "sent") any = true;
      }
      if (any) notified++;
    } catch (err) {
      console.error("✗ Les-melding versturen mislukt:", (err as Error).message);
    }
  }

  await audit("class.notify.sent", {
    actor,
    tenantId,
    targetType: "ClassSession",
    targetId: session.id,
    metadata: { kind, class: session.className, recipients: users.length, notified },
  });
  return notified;
}

/** Sessie + vestiging-tijdzone in de vorm die `notifyClassEvent` verwacht. */
export function toSessionInfo(s: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  groupClass: { name: string };
  venueLocation: { timezone: string };
}): ClassSessionInfo {
  return {
    id: s.id,
    className: s.groupClass.name,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    timezone: s.venueLocation.timezone,
  };
}

/**
 * Meld doorgeschoven wachtenden (ná commit van de vrijmakende transactie,
 * best-effort). Gedeeld door de rooster-actions (afmelden/capaciteit omhoog)
 * en het vrijgeven van plekken als een lid vertrekt (lib/class-enrollment.ts).
 */
export async function notifyPromotions(
  tenantId: string,
  promoted: { sessionId: string; userIds: string[] }[],
  actor?: ClassNotifyActor
): Promise<void> {
  for (const p of promoted) {
    const s = await prisma.classSession.findUnique({
      where: { id: p.sessionId },
      select: SESSION_INFO_SELECT,
    });
    if (!s) continue;
    await notifyClassEvent({
      tenantId,
      kind: "promoted",
      session: toSessionInfo(s),
      userIds: p.userIds,
      actor,
    });
  }
}

/** Selectie die `toSessionInfo` nodig heeft (voor include/select-sites). */
export const SESSION_INFO_SELECT = {
  id: true,
  startsAt: true,
  endsAt: true,
  groupClass: { select: { name: true } },
  venueLocation: { select: { timezone: true } },
} as const;
