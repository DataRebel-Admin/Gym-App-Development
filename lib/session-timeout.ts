import "server-only";
import { prisma } from "@/lib/db";

/**
 * Maximale duur van een open trainingssessie: **5 uur**. Een sessie die langer
 * openstaat wordt automatisch afgesloten (het lid vergat af te ronden). De
 * afronding wordt niet eindeloos doorgeteld: `endedAt` wordt gecapt op
 * `startedAt + 5u`, zodat de opgeslagen duur klopt.
 */
export const SESSION_MAX_MS = 5 * 60 * 60 * 1000;

export type TimeoutResult = { autoStopped: boolean; sessionId: string | null };

/**
 * Startmoment (ISO) van de lopende training, of `null` als er geen loopt.
 * Alleen lezen — bedoeld voor de "training bezig"-balk die op élke member-pagina
 * meeloopt; een write op elke navigatie zou onnodig zijn. Een sessie die al over
 * de 5-uur-grens is telt niet mee: de pagina-guards sluiten die af.
 */
export async function getRunningSessionStart(
  tenantId: string,
  userId: string
): Promise<string | null> {
  try {
    const open = await prisma.workoutSession.findFirst({
      where: { tenantId, userId, endedAt: null },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });
    if (!open) return null;
    const age = Date.now() - open.startedAt.getTime();
    return age <= SESSION_MAX_MS ? open.startedAt.toISOString() : null;
  } catch {
    // De balk is signalering; nooit een pagina laten struikelen.
    return null;
  }
}

/**
 * Sluit een te lang openstaande sessie automatisch af (idempotent). Wordt lazy
 * aangeroepen bij het openen van de actieve-sessie- en schema-pagina — géén cron
 * nodig, want zichtbaarheid is puur read-time. Best-effort: faalt nooit hard.
 *
 * Botst niet met handmatig afronden/annuleren: die zetten `endedAt` (of
 * verwijderen de sessie), waardoor de `endedAt == null`-filter niets meer vindt.
 */
export async function enforceSessionTimeout(
  tenantId: string,
  userId: string,
  now: Date = new Date()
): Promise<TimeoutResult> {
  try {
    const open = await prisma.workoutSession.findFirst({
      where: { tenantId, userId, endedAt: null },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true },
    });
    if (!open) return { autoStopped: false, sessionId: null };

    const age = now.getTime() - open.startedAt.getTime();
    if (age <= SESSION_MAX_MS) return { autoStopped: false, sessionId: open.id };

    // Cap de duur op precies 5 uur en markeer als automatisch gestopt.
    const cappedEnd = new Date(open.startedAt.getTime() + SESSION_MAX_MS);
    const res = await prisma.workoutSession.updateMany({
      where: { id: open.id, endedAt: null },
      data: { endedAt: cappedEnd, autoStoppedAt: now },
    });
    return { autoStopped: res.count > 0, sessionId: open.id };
  } catch {
    // Timeout-handhaving mag het laden van een pagina nooit breken.
    return { autoStopped: false, sessionId: null };
  }
}
