import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { evaluateDueMachines } from "@/lib/maintenance-eval";
import { notifyMaintenanceThresholds } from "@/lib/maintenance/notify";
import { isFeatureEnabled } from "@/lib/features/service";
import { cronAuthorized } from "@/lib/cron-auth";

/**
 * Dagelijkse onderhoudscontrole. Evalueert per tenant de gebruik- én
 * tijddrempels van alle machines, transitioneert de status (ACTIVE↔
 * MAINTENANCE_DUE) en stuurt de beheerders idempotente meldingen
 * ("bijna nodig"/"nu nodig"). Draait als Vercel Cron (zie vercel.json).
 *
 * Beveiliging: vereist `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron stuurt
 * die header mee). Fail-closed in productie — zonder CRON_SECRET wordt de route
 * daar geweigerd (zie lib/cron-auth.ts). Zet 'm dus in productie.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const origin =
    process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://app.gymrebel.app";

  // Alleen tenants met minstens één machine met een onderhoudsregel.
  const tenants = await prisma.tenant.findMany({
    where: {
      deletedAt: null,
      machines: {
        some: {
          OR: [
            { usageThreshold: { not: null } },
            { maintenanceIntervalDays: { not: null } },
          ],
        },
      },
    },
    select: { id: true },
  });

  let notified = 0;
  for (const t of tenants) {
    try {
      // Onderhoudsmodule uit (Superadmin-flag) → tenant overslaan.
      if (!(await isFeatureEnabled(t.id, "maintenance"))) continue;
      const { due, soon } = await evaluateDueMachines(t.id);
      notified += await notifyMaintenanceThresholds({
        tenantId: t.id,
        dueIds: due,
        soonIds: soon,
        origin,
      });
    } catch (err) {
      console.error("[cron] onderhoudscontrole mislukt:", (err as Error).message);
    }
  }

  return NextResponse.json({ tenants: tenants.length, notified });
}
