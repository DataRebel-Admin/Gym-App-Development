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
import { maintenanceAlertMessage } from "@/lib/email/messages";
import type { EmailBranding } from "@/lib/email/branding";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

// Meldingen over machine-onderhoud naar de tenant-gebruikers die het onderhoud
// beheren (permissie `maintenance:manage`). Spiegel van lib/schema-notify.ts:
// respecteert de persoonlijke voorkeuren (categorie "maintenance") over álle
// kanalen (in-app / push / e-mail) en faalt nooit hard. "Bijna/nu nodig" is
// idempotent via de markers op Machine; actie-events (uitgevoerd/status) niet.

type Recipient = {
  id: string;
  email: string;
  name: string | null;
  notificationPrefs: unknown;
  locale: Locale | null;
};

function defaultOrigin(): string {
  return (
    process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://app.gymrebel.app"
  ).replace(/\/$/, "");
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
    },
  });
  return users
    .filter((u) =>
      getEffectivePermissions(
        u.role,
        (u.permissions as PermissionOverrides | null) ?? null
      ).has("maintenance:manage")
    )
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      notificationPrefs: u.notificationPrefs,
      locale: u.locale,
    }));
}

type Delivery = { title: string; body: string; detail?: string | null };

/**
 * Bezorg één melding aan alle beheerders, per toegestaan kanaal. `build` levert
 * titel/body in de taal van elke ontvanger (per-locale root-translator).
 */
async function deliverToAll(opts: {
  tenantId: string;
  recipients: Recipient[];
  branding: EmailBranding;
  origin: string;
  machineName: string;
  build: (t: Translator) => Delivery;
}): Promise<number> {
  const { tenantId, recipients, branding, origin, machineName, build } = opts;
  const manageUrl = `${origin}/owner/maintenance`;
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

      if (prefAllows(prefs, "maintenance", "inApp")) {
        await createInAppNotification({
          userId: r.id,
          tenantId,
          category: "maintenance",
          title: delivery.title,
          body: delivery.body,
          link: "/owner/maintenance",
        });
        any = true;
      }
      if (prefAllows(prefs, "maintenance", "push")) {
        const delivered = await sendPushToUser(r.id, {
          title: delivery.title,
          body: delivery.body,
          url: "/owner/maintenance",
          tag: "maintenance",
        });
        if (delivered > 0) any = true;
      }
      if (prefAllows(prefs, "maintenance", "email")) {
        await sendEmail({
          to: r.email,
          message: await maintenanceAlertMessage({
            branding,
            recipientName: r.name,
            machineName,
            headline: delivery.title,
            intro: delivery.body,
            detail: delivery.detail ?? null,
            manageUrl,
            locale: r.locale,
          }),
          devLink: manageUrl,
        });
        any = true;
      }
      if (any) reached += 1;
    } catch (err) {
      console.error("✗ Onderhoudsmelding mislukt:", (err as Error).message);
    }
  }
  return reached;
}

/**
 * Meld dat machines nu (`due`) of binnenkort (`soon`) onderhoud nodig hebben.
 * Idempotent: alleen machines met een lege bijbehorende marker worden gemeld en
 * de marker wordt daarna gezet.
 */
export async function notifyMaintenanceThresholds(opts: {
  tenantId: string;
  dueIds?: string[];
  soonIds?: string[];
  origin?: string;
}): Promise<number> {
  const { tenantId } = opts;
  const dueIds = opts.dueIds ?? [];
  const soonIds = opts.soonIds ?? [];
  if (dueIds.length === 0 && soonIds.length === 0) return 0;
  // Onderhoudsmodule uit (Superadmin-flag) → geen meldingen.
  if (!(await isFeatureEnabled(tenantId, "maintenance"))) return 0;

  const origin = opts.origin ?? defaultOrigin();
  let recipients: Recipient[];
  let branding: EmailBranding;
  try {
    [recipients, branding] = await Promise.all([
      getRecipients(tenantId),
      loadTenantBranding(tenantId),
    ]);
  } catch (err) {
    console.error("✗ Onderhoudsmelding voorbereiden mislukt:", (err as Error).message);
    return 0;
  }
  if (recipients.length === 0) return 0;

  const now = new Date();
  let notified = 0;

  const groups: { ids: string[]; marker: "due" | "warn"; action: "machine.maintenance.due" | "machine.maintenance.warn"; titleKey: string; bodyKey: string }[] = [
    {
      ids: dueIds,
      marker: "due",
      action: "machine.maintenance.due",
      titleKey: "notifications.maintenance.dueTitle",
      bodyKey: "notifications.maintenance.dueBody",
    },
    {
      ids: soonIds,
      marker: "warn",
      action: "machine.maintenance.warn",
      titleKey: "notifications.maintenance.warnTitle",
      bodyKey: "notifications.maintenance.warnBody",
    },
  ];

  for (const g of groups) {
    if (g.ids.length === 0) continue;
    const machines = await prisma.machine.findMany({
      where: {
        id: { in: g.ids },
        tenantId,
        ...(g.marker === "due"
          ? { maintenanceDueNotifiedAt: null }
          : { maintenanceWarnNotifiedAt: null }),
      },
      select: { id: true, name: true },
    });

    for (const m of machines) {
      const reached = await deliverToAll({
        tenantId,
        recipients,
        branding,
        origin,
        machineName: m.name,
        build: (t) => ({ title: t(g.titleKey), body: t(g.bodyKey, { name: m.name }) }),
      });
      await prisma.machine
        .update({
          where: { id: m.id },
          data:
            g.marker === "due"
              ? { maintenanceDueNotifiedAt: now }
              : { maintenanceWarnNotifiedAt: now },
        })
        .catch(() => {});
      await audit(g.action, {
        actor: { email: "systeem", role: null },
        tenantId,
        targetType: "Machine",
        targetId: m.id,
        metadata: { name: m.name },
      });
      if (reached > 0) {
        await audit("machine.maintenance.notify.sent", {
          actor: { email: "systeem", role: null },
          tenantId,
          targetType: "Machine",
          targetId: m.id,
          metadata: { name: m.name, recipients: reached },
        });
      }
      notified += 1;
    }
  }

  return notified;
}

export type MaintenanceEvent = "performed" | "out_of_service" | "reactivated" | "in_maintenance";

const EVENT_COPY: Record<MaintenanceEvent, { titleKey: string; bodyKey: string }> = {
  performed: {
    titleKey: "notifications.maintenance.performedTitle",
    bodyKey: "notifications.maintenance.performedBody",
  },
  out_of_service: {
    titleKey: "notifications.maintenance.outOfServiceTitle",
    bodyKey: "notifications.maintenance.outOfServiceBody",
  },
  reactivated: {
    titleKey: "notifications.maintenance.reactivatedTitle",
    bodyKey: "notifications.maintenance.reactivatedBody",
  },
  in_maintenance: {
    titleKey: "notifications.maintenance.inMaintenanceTitle",
    bodyKey: "notifications.maintenance.inMaintenanceBody",
  },
};

/**
 * Meld een onderhouds-actie-event (uitgevoerd / status gewijzigd) aan de
 * beheerders. Niet marker-gegate (het is een eenmalige, expliciete actie).
 */
export async function notifyMaintenanceEvent(opts: {
  tenantId: string;
  machineId: string;
  machineName: string;
  event: MaintenanceEvent;
  detail?: string | null;
  origin?: string;
  excludeUserId?: string;
}): Promise<void> {
  const origin = opts.origin ?? defaultOrigin();
  try {
    // Onderhoudsmodule uit (Superadmin-flag) → geen meldingen.
    if (!(await isFeatureEnabled(opts.tenantId, "maintenance"))) return;
    const [all, branding] = await Promise.all([
      getRecipients(opts.tenantId),
      loadTenantBranding(opts.tenantId),
    ]);
    const recipients = all.filter((r) => r.id !== opts.excludeUserId);
    if (recipients.length === 0) return;
    const copy = EVENT_COPY[opts.event];
    await deliverToAll({
      tenantId: opts.tenantId,
      recipients,
      branding,
      origin,
      machineName: opts.machineName,
      build: (t) => ({
        title: t(copy.titleKey),
        body: t(copy.bodyKey, { name: opts.machineName }),
        detail: opts.detail ?? null,
      }),
    });
  } catch (err) {
    console.error("✗ Onderhoud-event-melding mislukt:", (err as Error).message);
  }
}
