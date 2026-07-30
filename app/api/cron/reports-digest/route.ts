import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email/send";
import { resolveEmailBranding } from "@/lib/email/branding";
import { reportDigestMessage, type ReportEmailSummary } from "@/lib/email/messages";
import { getSupportEmail } from "@/lib/platform-settings";
import { formatReportRef } from "@/lib/report-context";
import { reportOrigin } from "@/lib/report-query";

/**
 * Dagelijkse digest van nieuwe app-meldingen naar het dev-team. Urgente
 * gevallen (BLOCKER / piek) zijn al direct gemeld (lib/reports/notify.ts);
 * dit is het rustige overzicht van de rest. Skipt bij nul nieuwe meldingen.
 *
 * Beveiliging: Bearer CRON_SECRET (fail-closed in productie, lib/cron-auth.ts).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const reports = await prisma.appReport.findMany({
    where: { createdAt: { gte: dayAgo } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  if (reports.length === 0) {
    return NextResponse.json({ reports: 0, sent: false });
  }

  const tenantIds = [...new Set(reports.map((r) => r.tenantId).filter(Boolean))] as string[];
  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true },
      })
    : [];
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));

  const summaries: ReportEmailSummary[] = reports.map((r) => ({
    ref: formatReportRef(r.id),
    type: r.type,
    severity: r.severity,
    title: r.title,
    description: r.description,
    origin: reportOrigin(r.reporterRole),
    tenantName: r.tenantId ? (tenantName.get(r.tenantId) ?? null) : null,
    route: r.route,
    appVersion: r.appVersion,
    platform: r.platform,
    createdAt: r.createdAt,
  }));

  const origin =
    process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://app.gymrebel.app";
  const inboxUrl = `${origin}/admin/meldingen`;

  const message = await reportDigestMessage({
    branding: resolveEmailBranding(null),
    reports: summaries,
    inboxUrl,
  });
  const emailDelivery = await sendEmail({ to: await getSupportEmail(), message });

  return NextResponse.json({
    reports: reports.length,
    email: emailDelivery,
  });
}
