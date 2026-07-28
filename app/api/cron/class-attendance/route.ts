import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { NO_SHOW_GRACE_HOURS } from "@/lib/class-attendance";
import { audit } from "@/lib/audit";
import { cronAuthorized } from "@/lib/cron-auth";

/**
 * Dagelijkse no-show-markering: aanmeldingen die ná afloop van de les nog op
 * ENROLLED staan (staff heeft binnen de respijtperiode van
 * NO_SHOW_GRACE_HOURS geen aanwezigheid gemarkeerd) worden NO_SHOW. Voedt de
 * no-show-/retentie-analytics (lib/metrics). `markedById` blijft null =
 * automatisch gemarkeerd. Draait als Vercel Cron (zie vercel.json).
 *
 * Beveiliging: vereist `Authorization: Bearer ${CRON_SECRET}` (fail-closed in
 * productie, zie lib/cron-auth.ts).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - NO_SHOW_GRACE_HOURS * 3_600_000);
  const now = new Date();

  // Per tenant markeren + auditen (één regel per tenant, geen ruis per rij).
  const pending = await prisma.classEnrollment.groupBy({
    by: ["tenantId"],
    where: { status: "ENROLLED", session: { endsAt: { lt: cutoff } } },
    _count: true,
  });

  let marked = 0;
  for (const group of pending) {
    try {
      const res = await prisma.classEnrollment.updateMany({
        where: {
          tenantId: group.tenantId,
          status: "ENROLLED",
          session: { endsAt: { lt: cutoff } },
        },
        data: { status: "NO_SHOW", statusChangedAt: now },
      });
      marked += res.count;
      if (res.count > 0) {
        await audit("class.attendance.noshow", {
          actor: { email: "systeem", role: null },
          tenantId: group.tenantId,
          metadata: { count: res.count, source: "cron" },
        });
      }
    } catch (err) {
      console.error("[cron] no-show-markering mislukt:", (err as Error).message);
    }
  }

  return NextResponse.json({ tenants: pending.length, marked });
}
