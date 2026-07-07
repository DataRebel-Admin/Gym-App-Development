import "server-only";
import type { Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { localeFromEnum } from "@/lib/i18n/config";
import { audit } from "@/lib/audit";
import { loadTenantBranding } from "@/lib/email/branding";
import { schemaAssignedMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import { sendPushToUser } from "@/lib/push";
import { prefAllows, createInAppNotification } from "@/lib/notifications";

type Actor = { id?: string | null; email?: string | null; role?: Role | null };

const SYSTEM_ACTOR: Actor = { email: "systeem", role: null };

/**
 * Meld leden dat er een (nieuw) trainingsschema voor ze klaarstaat — over álle
 * toegestane kanalen (in-app / e-mail / push), met respect voor de persoonlijke
 * meldingsvoorkeuren (categorie "schemas").
 *
 * Gedeeld door de toewijs-action (direct publiceren) én de cron-route (geplande
 * publicatie). Best-effort: een verzendfout mag de toewijzing nooit breken.
 * Idempotent via `notifiedAt`: een al-gemelde toewijzing wordt overgeslagen.
 *
 * @returns aantal toewijzingen waarvoor (minstens één kanaal) gemeld is.
 */
export async function notifyAssignmentsPublished(opts: {
  tenantId: string;
  assignmentIds: string[];
  /** Basis-URL voor links (request-host of AUTH_URL in de cron). */
  origin: string;
  actor?: Actor;
}): Promise<number> {
  const { tenantId, assignmentIds, origin } = opts;
  const actor = opts.actor ?? SYSTEM_ACTOR;
  if (assignmentIds.length === 0) return 0;

  let branding;
  let assignments;
  try {
    [branding, assignments] = await Promise.all([
      loadTenantBranding(tenantId),
      prisma.assignedWorkout.findMany({
        where: {
          id: { in: assignmentIds },
          tenantId,
          status: "PUBLISHED",
          notifiedAt: null,
        },
        select: {
          id: true,
          trainerMessage: true,
          template: { select: { name: true } },
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              notificationPrefs: true,
              active: true,
              locale: true,
            },
          },
        },
      }),
    ]);
  } catch (err) {
    console.error("✗ Schema-meldingen ophalen mislukt:", (err as Error).message);
    return 0;
  }

  const viewUrl = `${origin.replace(/\/$/, "")}/member/schema`;
  let notified = 0;

  for (const a of assignments) {
    if (!a.user.active) continue;
    const prefs = a.user.notificationPrefs;
    const schemaName = a.template?.name ?? "Nieuw schema";
    const t = await getTranslations({ locale: localeFromEnum(a.user.locale) });
    const intro = a.trainerMessage?.trim()
      ? t("notifications.schemaAssigned.introMessage", {
          message: a.trainerMessage.trim(),
          schema: schemaName,
        })
      : t("notifications.schemaAssigned.introDefault", { schema: schemaName });

    const channels: string[] = [];

    try {
      if (prefAllows(prefs, "schemas", "inApp")) {
        await createInAppNotification({
          userId: a.user.id,
          tenantId,
          category: "schemas",
          title: t("notifications.schemaAssigned.title"),
          body: intro,
          link: "/member/schema",
        });
        channels.push("inApp");
      }

      if (prefAllows(prefs, "schemas", "push")) {
        const delivered = await sendPushToUser(a.user.id, {
          title: t("notifications.schemaAssigned.title"),
          body: t("notifications.schemaAssigned.pushBody"),
          url: "/member/schema",
          tag: "schema-assigned",
        });
        if (delivered > 0) channels.push("push");
      }

      let emailed = false;
      if (prefAllows(prefs, "schemas", "email")) {
        const delivery = await sendEmail({
          to: a.user.email,
          message: await schemaAssignedMessage({
            branding,
            recipientName: a.user.name,
            schemaName,
            viewUrl,
            locale: a.user.locale,
          }),
          devLink: viewUrl,
        });
        // Alleen als er echt iets bij de ontvanger is bezorgd tellen we het als
        // een e-mailkanaal en auditen we "e-mail verzonden" — anders liegt de
        // audittrail (geen transport geconfigureerd / killswitch uit).
        if (delivery === "sent") {
          emailed = true;
          channels.push("email");
        }
      }

      await prisma.assignedWorkout.update({
        where: { id: a.id },
        data: { notifiedAt: new Date() },
      });
      notified += 1;

      // Koppeling met schema-aanvragen: een lopende aanvraag van dit lid wordt
      // automatisch afgerond zodra er een schema voor ze gepubliceerd wordt.
      try {
        const { count } = await prisma.schemaRequest.updateMany({
          where: {
            tenantId,
            userId: a.user.id,
            status: { in: ["NEW", "IN_PROGRESS", "SCHEMA_CREATED"] },
          },
          data: { status: "COMPLETED", resolvedAssignmentId: a.id },
        });
        if (count > 0) {
          await audit("request.schema.link", {
            actor,
            tenantId,
            targetType: "User",
            targetId: a.user.id,
            metadata: { member: a.user.name ?? a.user.email, name: schemaName },
          });
        }
      } catch (err) {
        console.error("✗ Aanvraag-koppeling mislukt:", (err as Error).message);
      }

      // Audit: notificatie verzonden (in-app/push) + e-mail verzonden — apart,
      // zoals de feature-eisen vragen.
      if (channels.some((c) => c !== "email")) {
        await audit("schema.notify.sent", {
          actor,
          tenantId,
          targetType: "User",
          targetId: a.user.id,
          metadata: {
            name: schemaName,
            channels: channels.filter((c) => c !== "email"),
            member: a.user.name ?? a.user.email,
          },
        });
      }
      if (emailed) {
        await audit("schema.email.sent", {
          actor,
          tenantId,
          targetType: "User",
          targetId: a.user.id,
          metadata: { name: schemaName, to: a.user.email, kind: "schemaAssigned" },
        });
      }
    } catch (err) {
      console.error("✗ Schema-melding mislukt:", (err as Error).message);
    }
  }

  return notified;
}
