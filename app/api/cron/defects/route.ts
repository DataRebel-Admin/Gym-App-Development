import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron-auth";
import { runDefectsDigest, cleanupDefects } from "@/lib/defects/digest";

/**
 * Dagelijkse defect-taken (zie vercel.json):
 * 1. Samenvatting per tenant/vestiging — nieuwe MINOR/MAJOR-meldingen
 *    (idempotent via `digestedAt`) + achterstand ouder dan de per-gym-termijn.
 * 2. AVG-opschoning — foto's na 12 maanden, meldingen na 24 maanden
 *    (na afronding).
 *
 * Beveiliging: Bearer CRON_SECRET (fail-closed in productie, lib/cron-auth.ts).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const origin = (
    process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://app.gymrebel.app"
  ).replace(/\/$/, "");

  // Alleen tenants met defectmeldingen.
  const tenants = await prisma.equipmentDefect.groupBy({ by: ["tenantId"] });

  let notified = 0;
  for (const t of tenants) {
    try {
      notified += await runDefectsDigest(t.tenantId, origin);
    } catch (err) {
      console.error("[cron] defect-digest mislukt:", t.tenantId, (err as Error).message);
    }
  }

  let cleanup: { photos: number; removed: number } = { photos: 0, removed: 0 };
  try {
    cleanup = await cleanupDefects();
  } catch (err) {
    console.error("[cron] defect-opschoning mislukt:", (err as Error).message);
  }

  return NextResponse.json({ tenants: tenants.length, notified, ...cleanup });
}
