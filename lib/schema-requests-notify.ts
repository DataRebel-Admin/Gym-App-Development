import "server-only";
import { prisma } from "@/lib/db";
import { loadTenantBranding } from "@/lib/email/branding";
import { schemaRequestReceivedMessage, schemaRequestStatusMessage } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import { prefAllows, createInAppNotification } from "@/lib/notifications";
import { REQUEST_GOAL_LABELS, REQUEST_STATUS_META } from "@/lib/schema-requests";
import { getEffectivePermissions, type PermissionOverrides } from "@/lib/rbac";

/**
 * Meldingen voor de schema-aanvraagworkflow — in-app + e-mail, gegate op de
 * persoonlijke voorkeuren (categorie "schemas"). Best-effort: een verzendfout mag
 * de aanvraag-actie nooit breken (try/catch). Hergebruikt dezelfde infra als
 * lib/schema-notify.ts.
 */

function base(origin: string): string {
  return origin.replace(/\/$/, "");
}

/** Bij indienen: owners/admins informeren + het lid een in-app bevestiging geven. */
export async function notifyRequestSubmitted(opts: {
  tenantId: string;
  requestId: string;
  origin: string;
}): Promise<void> {
  try {
    const req = await prisma.schemaRequest.findFirst({
      where: { id: opts.requestId, tenantId: opts.tenantId },
      select: {
        goal: true,
        description: true,
        user: { select: { id: true, name: true, email: true, notificationPrefs: true } },
      },
    });
    if (!req) return;

    const branding = await loadTenantBranding(opts.tenantId);
    const memberName = req.user.name ?? req.user.email;
    const goalLabel = REQUEST_GOAL_LABELS[req.goal];
    const manageUrl = `${base(opts.origin)}/owner/requests`;

    // Eigenaar(s) én medewerkers die schema's beheren worden geïnformeerd.
    const candidates = await prisma.user.findMany({
      where: {
        tenantId: opts.tenantId,
        role: { in: ["TENANT_ADMIN", "TENANT_STAFF"] },
        active: true,
      },
      select: { id: true, name: true, email: true, notificationPrefs: true, role: true, permissions: true },
    });
    const owners = candidates.filter((u) =>
      getEffectivePermissions(
        u.role,
        (u.permissions as PermissionOverrides | null) ?? null
      ).has("schemas:manage")
    );

    for (const o of owners) {
      try {
        if (prefAllows(o.notificationPrefs, "schemas", "inApp")) {
          await createInAppNotification({
            userId: o.id,
            tenantId: opts.tenantId,
            category: "schemas",
            title: "Nieuwe schema-aanvraag",
            body: `${memberName} heeft een nieuw trainingsschema aangevraagd.`,
            link: "/owner/requests",
          });
        }
        if (prefAllows(o.notificationPrefs, "schemas", "email")) {
          await sendEmail({
            to: o.email,
            message: await schemaRequestReceivedMessage({
              branding,
              recipientName: o.name,
              memberName,
              goalLabel,
              description: req.description,
              manageUrl,
            }),
            devLink: manageUrl,
          });
        }
      } catch (err) {
        console.error("✗ Owner-melding aanvraag mislukt:", (err as Error).message);
      }
    }

    // In-app bevestiging voor het lid (e-mail volgt bij statuswijzigingen).
    if (prefAllows(req.user.notificationPrefs, "schemas", "inApp")) {
      await createInAppNotification({
        userId: req.user.id,
        tenantId: opts.tenantId,
        category: "schemas",
        title: "Aanvraag ontvangen",
        body: "Je trainer heeft je schema-aanvraag ontvangen. Je hoort het zodra er een update is.",
        link: "/member/requests",
      });
    }
  } catch (err) {
    console.error("✗ Aanvraag-melding mislukt:", (err as Error).message);
  }
}

/** Bij statuswijziging: het lid informeren via in-app + e-mail (voorkeursgegate). */
export async function notifyRequestStatusChanged(opts: {
  tenantId: string;
  requestId: string;
  origin: string;
}): Promise<void> {
  try {
    const req = await prisma.schemaRequest.findFirst({
      where: { id: opts.requestId, tenantId: opts.tenantId },
      select: {
        status: true,
        user: { select: { id: true, name: true, email: true, notificationPrefs: true } },
      },
    });
    if (!req) return;

    const statusLabel = REQUEST_STATUS_META[req.status].label;
    const viewUrl = `${base(opts.origin)}/member/requests`;
    const prefs = req.user.notificationPrefs;

    if (prefAllows(prefs, "schemas", "inApp")) {
      await createInAppNotification({
        userId: req.user.id,
        tenantId: opts.tenantId,
        category: "schemas",
        title: "Update over je schema-aanvraag",
        body: `Nieuwe status: ${statusLabel}.`,
        link: "/member/requests",
      });
    }
    if (prefAllows(prefs, "schemas", "email")) {
      const branding = await loadTenantBranding(opts.tenantId);
      await sendEmail({
        to: req.user.email,
        message: await schemaRequestStatusMessage({
          branding,
          recipientName: req.user.name,
          statusLabel,
          viewUrl,
        }),
        devLink: viewUrl,
      });
    }
  } catch (err) {
    console.error("✗ Statusmelding aanvraag mislukt:", (err as Error).message);
  }
}
