import "server-only";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notifyAssignmentsPublished } from "@/lib/schema-notify";
import { applyCarriedPlan, capturePlanForCarryOver } from "@/lib/calendar";
import { appBaseUrl } from "@/lib/app-url";

/**
 * Geplande schemapublicatie — de gedeelde kern van de cron
 * (`app/api/cron/publish-schemas`) én het luie pad hieronder.
 *
 * **WAAROM ER EEN LUI PAD IS.** Zichtbaarheid hangt aan de status:
 * `activeAssignmentWhere` (lib/member.ts) eist `status: PUBLISHED`, dus een
 * SCHEDULED-toewijzing blijft onzichtbaar tot iets hem omzet. Dat "iets" was
 * alleen de cron, en die draait op het Vercel Hobby-plan één keer per dag
 * (commit 0637e13). Een publicatie die om 10:00 gepland stond werd daardoor
 * pas de volgende ochtend zichtbaar.
 *
 * Nu publiceert het openen van de member-app een due schema meteen, met de
 * cron als vangnet voor wie de app níét opent (die moet z'n e-mail/push wel
 * krijgen). Zelfde idioom als `enforceSessionTimeout` in lib/session-timeout.ts.
 *
 * Gaat het project ooit naar Vercel Pro, dan mag de cron terug naar elke paar
 * minuten en wordt dit pad overbodig-maar-onschadelijk: wie er het eerst bij is
 * publiceert, de ander vindt niets meer (de `status`-filter in de `updateMany`
 * maakt het racevrij).
 */

export type DueAssignment = { id: string; tenantId: string; userId: string };

export type PublishResult = { published: number; notified: number };

/**
 * Publiceer een reeks due toewijzingen: archiveer per lid het vorige actieve
 * schema, zet deze op PUBLISHED en neem de weekdagplanning mee. Meldingen gaan
 * ná de transacties uit, gegroepeerd per tenant (idempotent via `notifiedAt`,
 * dus dubbel aanroepen levert geen dubbele melding op).
 *
 * `origin` bepaalt de links in de e-mail; laat 'm weg in een cron-context, dan
 * valt hij terug op `appBaseUrl()`.
 */
export async function publishDueAssignments(
  due: DueAssignment[],
  opts: { origin?: string; actorEmail?: string } = {}
): Promise<PublishResult> {
  if (due.length === 0) return { published: 0, notified: 0 };
  const now = new Date();
  const published: DueAssignment[] = [];

  for (const a of due) {
    try {
      const ok = await prisma.$transaction(async (tx) => {
        // Weekdagplanning van het vorige actieve schema meenemen — vóór het
        // archiveren vastpakken, ná het publiceren toepassen (lib/calendar.ts).
        const carried = await capturePlanForCarryOver(tx, a.tenantId, a.userId, a.id);
        // Alleen doorgaan als deze rij nog écht SCHEDULED is: draait de cron
        // tegelijk met een paginabezoek, dan wint er precies één en doet de
        // ander niets (geen dubbele archivering, geen dubbele melding).
        const claimed = await tx.assignedWorkout.updateMany({
          where: { id: a.id, status: "SCHEDULED" },
          data: { status: "PUBLISHED", publishedAt: now, availableFrom: null, notifiedAt: null },
        });
        if (claimed.count === 0) return false;
        await tx.assignedWorkout.updateMany({
          where: { tenantId: a.tenantId, userId: a.userId, status: "PUBLISHED", id: { not: a.id } },
          data: { status: "ARCHIVED", archivedAt: now },
        });
        await applyCarriedPlan(tx, { tenantId: a.tenantId, assignmentId: a.id, carried });
        return true;
      });
      if (ok) published.push(a);
    } catch (err) {
      console.error("✗ Geplande publicatie mislukt:", (err as Error).message);
    }
  }

  if (published.length === 0) return { published: 0, notified: 0 };

  // Groepeer per tenant voor de meldingen + audit.
  const byTenant = new Map<string, string[]>();
  for (const a of published) {
    const list = byTenant.get(a.tenantId) ?? [];
    list.push(a.id);
    byTenant.set(a.tenantId, list);
  }

  const origin = opts.origin ?? appBaseUrl();
  const actor = { email: opts.actorEmail ?? "systeem (cron)", role: null };
  let notified = 0;
  for (const [tenantId, assignmentIds] of byTenant) {
    try {
      notified += await notifyAssignmentsPublished({ tenantId, assignmentIds, origin });
      await audit("schema.publish", {
        actor,
        tenantId,
        targetType: "WorkoutTemplate",
        metadata: { memberCount: assignmentIds.length, source: "scheduled" },
      });
    } catch (err) {
      console.error("✗ Publicatiemelding mislukt:", (err as Error).message);
    }
  }

  return { published: published.length, notified };
}

/**
 * Lui pad: publiceer wat er voor **dit lid** klaarstaat. Aanroepen bij het
 * openen van de member-app; best-effort, breekt een pagina nooit.
 *
 * Doet eerst een goedkope leesquery en schrijft alleen als er echt iets
 * klaarstaat — dezelfde afweging als `getRunningSessionStart`: op elke
 * navigatie een write doen zou onnodig zijn.
 */
export async function publishDueSchedulesForMember(
  tenantId: string,
  userId: string,
  now: Date = new Date()
): Promise<PublishResult> {
  try {
    const due = await prisma.assignedWorkout.findMany({
      where: { tenantId, userId, status: "SCHEDULED", availableFrom: { lte: now } },
      select: { id: true },
      // Meerdere due toewijzingen tegelijk is een randgeval (de coach plande er
      // twee); de nieuwste wint doordat hij als laatste publiceert en de rest
      // archiveert.
      orderBy: { availableFrom: "asc" },
    });
    if (due.length === 0) return { published: 0, notified: 0 };
    return await publishDueAssignments(
      due.map((d) => ({ id: d.id, tenantId, userId })),
      { actorEmail: "systeem" }
    );
  } catch (err) {
    // Publicatie is een bijwerking van het openen van een pagina; die pagina
    // mag er nooit op stuklopen.
    console.error("✗ Luie publicatie mislukt:", (err as Error).message);
    return { published: 0, notified: 0 };
  }
}
