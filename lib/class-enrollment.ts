import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { withSerializableRetry } from "@/lib/db-retry";
import { notifyPromotions, type ClassNotifyActor } from "@/lib/class-notify";
import {
  ACTIVE_ENROLLMENT_STATUSES,
  promotableCount,
  sessionCapacity,
} from "@/lib/class-attendance";

type Tx = Prisma.TransactionClient;

/**
 * Schuift wachtenden door naar ENROLLED zolang er plek is (na afmelden, na een
 * capaciteitsverhoging). Draait **binnen** de transactie van de veroorzakende
 * mutatie zodat de telling consistent is; meldingen stuurt de caller ná commit
 * (best-effort) op basis van de teruggegeven userIds.
 *
 * Volgorde = `enrolledAt` (wie het eerst op de wachtlijst kwam, gaat het eerst).
 */
export async function promoteWaitlist(tx: Tx, sessionId: string): Promise<string[]> {
  const session = await tx.classSession.findUnique({
    where: { id: sessionId },
    select: {
      maxParticipants: true,
      cancelledAt: true,
      groupClass: { select: { maxParticipants: true } },
    },
  });
  // In een geannuleerde sessie schuift niemand door — die plek bestaat niet meer.
  if (!session || session.cancelledAt) return [];

  const [activeCount, waiting] = await Promise.all([
    tx.classEnrollment.count({
      where: { sessionId, status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } },
    }),
    tx.classEnrollment.findMany({
      where: { sessionId, status: "WAITLISTED" },
      orderBy: { enrolledAt: "asc" },
      select: { id: true, userId: true },
    }),
  ]);

  const n = promotableCount({
    capacity: sessionCapacity(session),
    activeCount,
    waitlistCount: waiting.length,
  });
  if (n === 0) return [];

  const chosen = waiting.slice(0, n);
  await tx.classEnrollment.updateMany({
    where: { id: { in: chosen.map((w) => w.id) } },
    data: { status: "ENROLLED", statusChangedAt: new Date(), markedById: null },
  });
  return chosen.map((w) => w.userId);
}

/** Wachtlijst-doorschuiving voor meerdere sessies (na het verhogen van de les-default). */
export async function promoteWaitlists(
  tx: Tx,
  sessionIds: string[]
): Promise<{ sessionId: string; userIds: string[] }[]> {
  const out: { sessionId: string; userIds: string[] }[] = [];
  for (const sessionId of sessionIds) {
    const userIds = await promoteWaitlist(tx, sessionId);
    if (userIds.length > 0) out.push({ sessionId, userIds });
  }
  return out;
}

/**
 * Geef de toekomstige lesplekken van een lid vrij bij deactiveren, archiveren
 * of verwijderen: ENROLLED/WAITLISTED-rijen van nog niet gestarte sessies gaan
 * naar CANCELLED en per vrijgekomen plek schuift de wachtlijst door — in één
 * Serializable-transactie (met retry), net als afmelden door het lid zelf.
 * Zonder deze stap bezet een vertrokken lid plekken tot de no-show-cron ná de
 * les, en bij verwijderen cascadeert de rij weg zónder dat iemand doorschuift.
 *
 * Bij verwijderen dus **vóór** de `user.delete` aanroepen. Best-effort: een
 * fout hier mag de ledenadministratie nooit blokkeren (meldingen aan
 * doorgeschoven leden zijn dat sowieso al).
 */
export async function releaseMemberClassSpots(
  tenantId: string,
  userId: string,
  actor?: ClassNotifyActor
): Promise<void> {
  try {
    const promoted = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const rows = await tx.classEnrollment.findMany({
            where: {
              tenantId,
              userId,
              status: { in: ["ENROLLED", "WAITLISTED"] },
              session: { startsAt: { gt: new Date() } },
            },
            select: { id: true, sessionId: true, status: true },
          });
          if (rows.length === 0) return [];
          await tx.classEnrollment.updateMany({
            where: { id: { in: rows.map((r) => r.id) } },
            data: { status: "CANCELLED", statusChangedAt: new Date() },
          });
          // Alleen een ENROLLED-rij bezette een plek; alleen dáár kan iemand doorschuiven.
          const freed = [
            ...new Set(rows.filter((r) => r.status === "ENROLLED").map((r) => r.sessionId)),
          ];
          return promoteWaitlists(tx, freed);
        },
        { isolationLevel: "Serializable" }
      )
    );
    if (promoted.length > 0) await notifyPromotions(tenantId, promoted, actor);
  } catch (err) {
    console.error("✗ Lesplekken vrijgeven mislukt:", (err as Error).message);
  }
}
