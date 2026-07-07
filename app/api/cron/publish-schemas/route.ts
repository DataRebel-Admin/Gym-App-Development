import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notifyAssignmentsPublished } from "@/lib/schema-notify";
import { cronAuthorized } from "@/lib/cron-auth";

/**
 * Geplande publicatie van trainingsschema's. Publiceert toewijzingen met status
 * SCHEDULED zodra `availableFrom` is bereikt en stuurt de leden hun melding.
 *
 * Draaien als **Vercel Cron** (zie vercel.json) — hergebruikt bewust de volledige
 * TS-notificatie-/e-mail-/push-architectuur i.p.v. een los script. Idempotent:
 * een al-gepubliceerde toewijzing wordt niet opnieuw opgepakt; `notifiedAt`
 * voorkomt dubbele meldingen.
 *
 * Beveiliging: vereist `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron stuurt
 * deze header automatisch mee). Fail-closed in productie — zonder CRON_SECRET
 * wordt de route daar geweigerd (zie lib/cron-auth.ts). Zet 'm dus in productie.
 */
export const dynamic = "force-dynamic";

const BATCH = 500;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.assignedWorkout.findMany({
    where: { status: "SCHEDULED", availableFrom: { lte: now } },
    select: { id: true, tenantId: true, userId: true },
    take: BATCH,
  });

  if (due.length === 0) {
    return NextResponse.json({ published: 0, notified: 0 });
  }

  // Per toewijzing: archiveer een vorig actief schema en publiceer dit schema.
  for (const a of due) {
    try {
      await prisma.$transaction([
        prisma.assignedWorkout.updateMany({
          where: { tenantId: a.tenantId, userId: a.userId, status: "PUBLISHED" },
          data: { status: "ARCHIVED" },
        }),
        prisma.assignedWorkout.update({
          where: { id: a.id },
          data: { status: "PUBLISHED", publishedAt: now, availableFrom: null, notifiedAt: null },
        }),
      ]);
    } catch (err) {
      console.error("[cron] publiceren mislukt:", (err as Error).message);
    }
  }

  // Groepeer per tenant voor de meldingen + audit.
  const byTenant = new Map<string, string[]>();
  for (const a of due) {
    const list = byTenant.get(a.tenantId) ?? [];
    list.push(a.id);
    byTenant.set(a.tenantId, list);
  }

  const origin = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://app.gymrebel.app";
  let notified = 0;

  for (const [tenantId, assignmentIds] of byTenant) {
    notified += await notifyAssignmentsPublished({ tenantId, assignmentIds, origin });
    await audit("schema.publish", {
      actor: { email: "systeem (cron)", role: null },
      tenantId,
      targetType: "WorkoutTemplate",
      metadata: { memberCount: assignmentIds.length, source: "scheduled" },
    });
  }

  return NextResponse.json({ published: due.length, notified });
}
