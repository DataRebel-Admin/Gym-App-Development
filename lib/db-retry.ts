import "server-only";
import { Prisma } from "@prisma/client";

/**
 * Voert `fn` (typisch een `prisma.$transaction(…, { isolationLevel:
 * "Serializable" })`) uit en probeert opnieuw bij een serialisatie-conflict
 * (Prisma P2034 = Postgres 40001 "could not serialize access").
 *
 * Waarom: onder READ COMMITTED zien twee gelijktijdige transacties dezelfde
 * "nog 1 plek vrij" en schrijven allebei — een count-then-insert is dan geen
 * invariant. Serializable laat Postgres het conflict detecteren en één van de
 * twee afbreken; die doet het hier gewoon opnieuw en ziet dan de bijgewerkte
 * telling. Geen ruwe SQL nodig (geen `SELECT … FOR UPDATE`).
 */
export async function withSerializableRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!isConflict) throw err;
      // Korte, oplopende pauze zodat de winnaar kan committen.
      await new Promise((r) => setTimeout(r, 25 * (i + 1)));
    }
  }
  throw lastError;
}
