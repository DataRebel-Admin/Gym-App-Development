import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron-auth";
import { audit } from "@/lib/audit";
import { blobConfigured } from "@/lib/blob";
import { REPORT_SCREENSHOT_RETENTION_DAYS } from "@/lib/constants";

/**
 * AVG-retentie: verwijdert melding-screenshots 6 maanden na afronding
 * (RESOLVED/WONTFIX/DUPLICATE → resolvedAt gezet). De melding zelf blijft
 * (forensisch, zoals AuditLog); alleen de screenshot-blob + verwijzing gaan
 * weg. Eerste `del()`-gebruik van @vercel/blob in de codebase.
 *
 * Best-effort per rij: een falende blob-delete blokkeert de rest niet en de
 * DB-verwijzing wordt pas genuld als de blob echt weg is (of geen blob-URL is).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(
    Date.now() - REPORT_SCREENSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  const due = await prisma.appReport.findMany({
    where: { resolvedAt: { not: null, lte: cutoff }, screenshotKey: { not: null } },
    select: { id: true, tenantId: true, screenshotKey: true },
    take: 200,
  });

  let cleaned = 0;
  for (const report of due) {
    try {
      const key = report.screenshotKey;
      if (key?.startsWith("https://") && blobConfigured()) {
        await del(key);
      }
      await prisma.appReport.update({
        where: { id: report.id },
        data: { screenshotKey: null },
      });
      cleaned++;
    } catch (err) {
      console.error(
        "[cron] screenshot-opschoning mislukt:",
        report.id,
        (err as Error).message
      );
    }
  }

  if (cleaned > 0) {
    await audit("report.retention.cleanup", {
      actor: { email: "systeem (cron)", role: null },
      targetType: "AppReport",
      metadata: { count: cleaned, retentionDays: REPORT_SCREENSHOT_RETENTION_DAYS },
    });
  }

  return NextResponse.json({ due: due.length, cleaned });
}
