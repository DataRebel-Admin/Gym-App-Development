import "server-only";
import type { Locale } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isFeatureEnabled } from "@/lib/features/service";
import {
  getEffectivePermissions,
  type PermissionOverrides,
} from "@/lib/rbac";
import { localeFromEnum, type AppLocale } from "@/lib/i18n/config";
import { prefAllows, createInAppNotification } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/push";
import { sendEmail } from "@/lib/email/send";
import { loadTenantBranding } from "@/lib/email/branding";
import { defectAlertMessage } from "@/lib/email/messages";
import type { EmailBranding } from "@/lib/email/branding";
import { appBaseUrl } from "@/lib/app-url";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

// Meldingen over apparaatdefecten naar de tenant-gebruikers die ze behandelen
// (permissie `defects:manage`) én toegang hebben tot de VESTIGING van de
// melding: admins altijd, medewerkers alleen via hun StaffLocationAccess-
// koppeling (deny-by-default — spiegel van lib/maintenance/notify.ts).
// Respecteert de persoonlijke voorkeuren (categorie "defects") over álle
// kanalen (in-app / push / e-mail) en faalt nooit hard.
//
// Direct verstuurd: UNSAFE bij aanmaak en een severity-bump na ≥3
// bevestigingen. MINOR/MAJOR komen in de dagelijkse samenvatting (cron).
// De melder krijgt bij RESOLVED een kort bericht (alleen niet-anoniem).

type Recipient = {
  id: string;
  email: string;
  name: string | null;
  notificationPrefs: unknown;
  locale: Locale | null;
  isAdmin: boolean;
  locationIds: Set<string>;
};

function defaultOrigin(): string {
  return appBaseUrl();
}

async function getRecipients(tenantId: string): Promise<Recipient[]> {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      active: true,
      archivedAt: null,
      role: { in: ["TENANT_ADMIN", "TENANT_STAFF"] },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
      notificationPrefs: true,
      locale: true,
      staffLocationAccess: { select: { locationId: true } },
    },
  });
  return users
    .filter((u) =>
      getEffectivePermissions(
        u.role,
        (u.permissions as PermissionOverrides | null) ?? null
      ).has("defects:manage")
    )
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      notificationPrefs: u.notificationPrefs,
      locale: u.locale,
      isAdmin: u.role === "TENANT_ADMIN",
      locationIds: new Set(u.staffLocationAccess.map((a) => a.locationId)),
    }));
}

/** Ontvangers voor een melding op déze vestiging (admins + gekoppelde staff). */
function recipientsForLocation(recipients: Recipient[], locationId: string): Recipient[] {
  return recipients.filter((r) => r.isAdmin || r.locationIds.has(locationId));
}

type Delivery = { title: string; body: string; detail?: string | null };

/** Bezorg één melding aan alle behandelaars, per toegestaan kanaal. */
async function deliverToAll(opts: {
  tenantId: string;
  recipients: Recipient[];
  branding: EmailBranding;
  origin: string;
  machineLabel: string;
  build: (t: Translator) => Delivery;
}): Promise<number> {
  const { tenantId, recipients, branding, origin, machineLabel, build } = opts;
  const manageUrl = `${origin}/owner/defects`;
  let reached = 0;

  const trCache = new Map<AppLocale, Translator>();
  const trFor = async (loc: AppLocale): Promise<Translator> => {
    const cached = trCache.get(loc);
    if (cached) return cached;
    const t = await getTranslations({ locale: loc });
    trCache.set(loc, t);
    return t;
  };

  for (const r of recipients) {
    try {
      const prefs = r.notificationPrefs;
      const delivery = build(await trFor(localeFromEnum(r.locale)));
      let any = false;

      if (prefAllows(prefs, "defects", "inApp")) {
        await createInAppNotification({
          userId: r.id,
          tenantId,
          category: "defects",
          title: delivery.title,
          body: delivery.body,
          link: "/owner/defects",
        });
        any = true;
      }
      if (prefAllows(prefs, "defects", "push")) {
        const delivered = await sendPushToUser(r.id, {
          title: delivery.title,
          body: delivery.body,
          url: "/owner/defects",
          tag: "defects",
          category: "defects",
        });
        if (delivered > 0) any = true;
      }
      if (prefAllows(prefs, "defects", "email")) {
        const emailDelivery = await sendEmail({
          to: r.email,
          message: await defectAlertMessage({
            branding,
            recipientName: r.name,
            machineName: machineLabel,
            headline: delivery.title,
            intro: delivery.body,
            detail: delivery.detail ?? null,
            manageUrl,
            locale: r.locale,
          }),
          devLink: manageUrl,
        });
        if (emailDelivery === "sent") any = true;
      }
      if (any) reached += 1;
    } catch (err) {
      console.error("✗ Defectmelding bezorgen mislukt:", (err as Error).message);
    }
  }
  return reached;
}

export type DefectNotifyEvent = "unsafe" | "escalated";

const EVENT_COPY: Record<DefectNotifyEvent, { titleKey: string; bodyKey: string }> = {
  unsafe: {
    titleKey: "notifications.defects.unsafeTitle",
    bodyKey: "notifications.defects.unsafeBody",
  },
  escalated: {
    titleKey: "notifications.defects.escalatedTitle",
    bodyKey: "notifications.defects.escalatedBody",
  },
};

/**
 * Directe melding aan de behandelaars van de vestiging (UNSAFE-melding of
 * severity-escalatie na bevestigingen). Best-effort — breekt de actie nooit.
 */
export async function notifyDefectEvent(opts: {
  tenantId: string;
  defectId: string;
  locationId: string;
  machineLabel: string;
  symptomLabel: string;
  event: DefectNotifyEvent;
  detail?: string | null;
  origin?: string;
  excludeUserId?: string;
}): Promise<void> {
  const origin = opts.origin ?? defaultOrigin();
  try {
    if (!(await isFeatureEnabled(opts.tenantId, "defects"))) return;
    const [all, branding] = await Promise.all([
      getRecipients(opts.tenantId),
      loadTenantBranding(opts.tenantId),
    ]);
    const recipients = recipientsForLocation(all, opts.locationId).filter(
      (r) => r.id !== opts.excludeUserId
    );
    if (recipients.length === 0) return;
    const copy = EVENT_COPY[opts.event];
    const reached = await deliverToAll({
      tenantId: opts.tenantId,
      recipients,
      branding,
      origin,
      machineLabel: opts.machineLabel,
      build: (t) => ({
        title: t(copy.titleKey),
        body: t(copy.bodyKey, { name: opts.machineLabel, symptom: opts.symptomLabel }),
        detail: opts.detail ?? null,
      }),
    });
    if (reached > 0) {
      await audit("defect.notify.sent", {
        actor: { email: "systeem", role: null },
        tenantId: opts.tenantId,
        targetType: "EquipmentDefect",
        targetId: opts.defectId,
        metadata: { machine: opts.machineLabel, event: opts.event, recipients: reached },
      });
    }
  } catch (err) {
    console.error("✗ Defect-event-melding mislukt:", (err as Error).message);
  }
}

/**
 * Kort bericht aan de melder wanneer zijn melding is opgelost — zonder jargon.
 * Alleen bij niet-anonieme meldingen (er ís anders geen melder bekend).
 */
export async function notifyReporterResolved(opts: {
  tenantId: string;
  reporterId: string;
  machineLabel: string;
  origin?: string;
}): Promise<void> {
  const origin = opts.origin ?? defaultOrigin();
  try {
    if (!(await isFeatureEnabled(opts.tenantId, "defects"))) return;
    const reporter = await prisma.user.findFirst({
      where: { id: opts.reporterId, tenantId: opts.tenantId, active: true },
      select: { id: true, email: true, name: true, notificationPrefs: true, locale: true },
    });
    if (!reporter) return;
    const t = await getTranslations({ locale: localeFromEnum(reporter.locale) });
    const title = t("notifications.defects.resolvedTitle");
    const body = t("notifications.defects.resolvedBody", { name: opts.machineLabel });
    const link = "/member/defects";

    if (prefAllows(reporter.notificationPrefs, "defects", "inApp")) {
      await createInAppNotification({
        userId: reporter.id,
        tenantId: opts.tenantId,
        category: "defects",
        title,
        body,
        link,
      });
    }
    if (prefAllows(reporter.notificationPrefs, "defects", "push")) {
      await sendPushToUser(reporter.id, { title, body, url: link, tag: "defects", category: "defects" });
    }
    if (prefAllows(reporter.notificationPrefs, "defects", "email")) {
      const branding = await loadTenantBranding(opts.tenantId);
      await sendEmail({
        to: reporter.email,
        message: await defectAlertMessage({
          branding,
          recipientName: reporter.name,
          machineName: opts.machineLabel,
          headline: title,
          intro: body,
          detail: null,
          manageUrl: `${origin}${link}`,
          locale: reporter.locale,
        }),
        devLink: `${origin}${link}`,
      });
    }
  } catch (err) {
    console.error("✗ Melder-informeren mislukt:", (err as Error).message);
  }
}

export { getRecipients as getDefectRecipients, recipientsForLocation as defectRecipientsForLocation, deliverToAll as deliverDefectToAll };
