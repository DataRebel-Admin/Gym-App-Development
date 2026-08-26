import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { REMINDER_WINDOW_HOURS } from "@/lib/class-attendance";
import { notifyClassEvent, toSessionInfo, SESSION_INFO_SELECT } from "@/lib/class-notify";
import { audit } from "@/lib/audit";
import { cronAuthorized } from "@/lib/cron-auth";

/**
 * Dagelijkse les-herinnering: aangemelde leden van sessies die binnen
 * `REMINDER_WINDOW_HOURS` starten krijgen één herinnering (in-app/push/e-mail
 * volgens hun voorkeuren, categorie `classes`). Idempotent via
 * `ClassEnrollment.remindedAt` — het venster is ruimer dan 24u zodat een
 * dagelijkse run geen les mist, en de marker voorkomt dubbele meldingen.
 * Draait als Vercel Cron (zie vercel.json).
 *
 * Beveiliging: vereist `Authorization: Bearer ${CRON_SECRET}` (fail-closed in
 * productie, zie lib/cron-auth.ts).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const until = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3_600_000);

  const sessions = await prisma.classSession.findMany({
    where: {
      startsAt: { gt: now, lte: until },
      enrollments: { some: { status: "ENROLLED", remindedAt: null } },
    },
    select: {
      ...SESSION_INFO_SELECT,
      tenantId: true,
      enrollments: {
        where: { status: "ENROLLED", remindedAt: null },
        select: { id: true, userId: true },
      },
    },
  });

  let reminded = 0;
  const perTenant = new Map<string, number>();
  for (const s of sessions) {
    try {
      // Eerst markeren (idempotentie wint van een eventueel mislukte verzending;
      // een gemiste herinnering is onschuldiger dan een dubbele).
      await prisma.classEnrollment.updateMany({
        where: { id: { in: s.enrollments.map((e) => e.id) } },
        data: { remindedAt: now },
      });
      const n = await notifyClassEvent({
        tenantId: s.tenantId,
        kind: "reminder",
        session: toSessionInfo(s),
        userIds: s.enrollments.map((e) => e.userId),
      });
      reminded += n;
      perTenant.set(s.tenantId, (perTenant.get(s.tenantId) ?? 0) + n);
    } catch (err) {
      console.error("[cron] les-herinnering mislukt:", (err as Error).message);
    }
  }

  for (const [tenantId, count] of perTenant) {
    if (count > 0) {
      await audit("class.reminder.sent", {
        actor: { email: "systeem", role: null },
        tenantId,
        metadata: { count, source: "cron" },
      });
    }
  }

  return NextResponse.json({ sessions: sessions.length, reminded });
}
