import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  MAX_REMIND_HOURS,
  reminderDue,
  resolveBookingRules,
} from "@/lib/class-attendance";
import { BOOKING_DEFAULTS_SELECT, BOOKING_OVERRIDE_SELECT } from "@/lib/class-booking";
import { notifyClassEvent, toSessionInfo, SESSION_INFO_SELECT } from "@/lib/class-notify";
import { audit } from "@/lib/audit";
import { cronAuthorized } from "@/lib/cron-auth";

/**
 * Les-herinnering. Draait **elk uur** (zie vercel.json), zodat de sportschool
 * zelf kan kiezen hoeveel uur van tevoren de melding uitgaat
 * (`Tenant.classRemindHoursBefore`, per lestype te overschrijven).
 *
 * Eerder draaide dit één keer per dag met een venster van 30 uur: de
 * voorsprong varieerde daardoor van ongeveer een uur tot ruim een dag, terwijl
 * je bij lessen juist "de avond ervoor" of "twee uur van tevoren" wilt.
 *
 * De query pakt alles binnen de maximale voorsprong (MAX_REMIND_HOURS) en de
 * daadwerkelijke grens wordt per sessie bepaald — een lestype met een eigen
 * instelling mag korter of langer vooruit melden dan de rest.
 * Idempotent via `ClassEnrollment.remindedAt`.
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
  const until = new Date(now.getTime() + MAX_REMIND_HOURS * 3_600_000);

  const sessions = await prisma.classSession.findMany({
    where: {
      startsAt: { gt: now, lte: until },
      // Geen herinnering voor een geannuleerde sessie (leden zijn al geïnformeerd)
      // of voor een lestype dat uit het aanbod is gehaald.
      cancelledAt: null,
      groupClass: { archivedAt: null },
      enrollments: { some: { status: "ENROLLED", remindedAt: null } },
    },
    select: {
      ...SESSION_INFO_SELECT,
      tenantId: true,
      groupClass: { select: { name: true, ...BOOKING_OVERRIDE_SELECT } },
      enrollments: {
        where: { status: "ENROLLED", remindedAt: null },
        select: { id: true, userId: true },
      },
    },
  });

  // Sportschool-standaard per tenant, één keer opgehaald (niet per sessie).
  const tenantIds = [...new Set(sessions.map((s) => s.tenantId))];
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, ...BOOKING_DEFAULTS_SELECT },
  });
  const defaultsById = new Map(tenants.map((t) => [t.id, t]));

  let reminded = 0;
  let skipped = 0;
  const perTenant = new Map<string, number>();
  for (const s of sessions) {
    const defaults = defaultsById.get(s.tenantId);
    if (!defaults) continue;
    const rules = resolveBookingRules(s.groupClass, defaults);
    // Nog te vroeg voor déze les: een volgende run pakt 'm op. `reminderDue`
    // bewaakt dat "een volgende run" ook echt bestáát vóór de les begint —
    // anders slaat een dagelijkse cron een les stilzwijgend helemaal over.
    if (!reminderDue({ startsAt: s.startsAt, now, remindHoursBefore: rules.remindHoursBefore })) {
      skipped++;
      continue;
    }
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

  return NextResponse.json({ sessions: sessions.length, reminded, skipped });
}
