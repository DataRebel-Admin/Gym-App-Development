import "server-only";
import type { Prisma } from "@prisma/client";
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
    select: { maxParticipants: true, groupClass: { select: { maxParticipants: true } } },
  });
  if (!session) return [];

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
