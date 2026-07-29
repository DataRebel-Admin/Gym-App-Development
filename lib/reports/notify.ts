import "server-only";
import type { AppReport } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send";
import { resolveEmailBranding, loadTenantBranding } from "@/lib/email/branding";
import {
  reportAlertMessage,
  reportResolvedMessage,
  type ReportEmailSummary,
} from "@/lib/email/messages";
import { getSupportEmail } from "@/lib/platform-settings";
import { notifyInApp } from "@/lib/notifications";
import { sendSlackMessage, slackConfigured } from "@/lib/reports/slack";
import { formatReportRef } from "@/lib/report-context";
import { reportOrigin } from "@/lib/report-query";

// Notificaties rond app-meldingen. Alles best-effort: een falend kanaal
// breekt de melding/actie nooit (patroon lib/maintenance/notify.ts).

const ORIGIN = () =>
  process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://app.gymrebel.app";

async function toSummary(report: AppReport): Promise<ReportEmailSummary> {
  const tenant = report.tenantId
    ? await prisma.tenant
        .findUnique({ where: { id: report.tenantId }, select: { name: true } })
        .catch(() => null)
    : null;
  return {
    ref: formatReportRef(report.id),
    type: report.type,
    severity: report.severity,
    title: report.title,
    description: report.description,
    origin: reportOrigin(report.reporterRole),
    tenantName: tenant?.name ?? null,
    route: report.route,
    appVersion: report.appVersion,
    platform: report.platform,
    createdAt: report.createdAt,
  };
}

/**
 * Direct signaal naar het dev-team: BLOCKER-severity of een piek (≥3 meldingen
 * binnen een uur op dezelfde route). Slack eerst; niet geconfigureerd of
 * mislukt → e-mail naar het support-/dev-adres. Nooit hard falen.
 */
export async function notifyDevTeamImmediate(
  report: AppReport,
  reason: "blocker" | "burst"
): Promise<void> {
  try {
    const summary = await toSummary(report);
    const inboxUrl = `${ORIGIN()}/admin/meldingen`;

    if (slackConfigured()) {
      const head =
        reason === "blocker" ? "🚨 *BLOCKER-melding*" : "📈 *Piek op één route*";
      const lines = [
        `${head} — ${summary.ref}`,
        `*${summary.title}* (${summary.type} · ${summary.severity})`,
        [summary.origin, summary.tenantName, summary.route, summary.appVersion, summary.platform]
          .filter(Boolean)
          .join(" · "),
        inboxUrl,
      ];
      const sent = await sendSlackMessage(lines.join("\n"));
      if (sent) return;
    }

    const message = await reportAlertMessage({
      branding: resolveEmailBranding(null),
      report: summary,
      reason,
      inboxUrl,
    });
    await sendEmail({ to: await getSupportEmail(), message });
  } catch (err) {
    console.error("[reports] dev-team-notificatie mislukt:", err);
  }
}

/**
 * Informeert de melder dat zijn melding is opgelost — alléén aangeroepen als
 * `contactAllowed` en er een `reportedById` is. In-app + e-mail, in de taal en
 * huisstijl van de eigen sportschool. Best-effort.
 */
export async function notifyReporterResolved(report: AppReport): Promise<void> {
  if (!report.reportedById) return;
  try {
    const user = await prisma.user.findUnique({
      where: { id: report.reportedById },
      select: { id: true, name: true, email: true, tenantId: true, locale: true, active: true },
    });
    if (!user || !user.active) return;

    const ref = formatReportRef(report.id);

    await notifyInApp({
      userId: user.id,
      tenantId: user.tenantId,
      category: "system",
      title: `Je melding ${ref} is opgelost`,
      body: report.title,
    });

    if (user.email) {
      const branding = await loadTenantBranding(user.tenantId);
      const message = await reportResolvedMessage({
        branding,
        recipientName: user.name,
        reportRef: ref,
        reportTitle: report.title,
        locale: user.locale,
      });
      await sendEmail({ to: user.email, message });
    }

    await audit("report.notify.sent", {
      actor: { email: "systeem", role: null },
      tenantId: report.tenantId,
      targetType: "AppReport",
      targetId: report.id,
      metadata: { kind: "resolved" },
    });
  } catch (err) {
    console.error("[reports] melder-notificatie mislukt:", err);
  }
}
