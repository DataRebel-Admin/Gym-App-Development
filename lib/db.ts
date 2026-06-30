import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. In development bewaart Next.js modules tussen
 * hot-reloads; zonder singleton zou elke reload een nieuwe client + connectie
 * openen en de database-verbindingen uitputten.
 *
 * Neon (serverless Postgres) verbreekt inactieve verbindingen en suspendt de
 * compute na idle. Een gedropte verbinding levert dan een transiente
 * `ConnectionReset`/`Closed`-fout op bij de eerstvolgende query. We vangen die
 * af met een korte retry (de engine reconnect vanzelf bij de volgende poging),
 * zodat zo'n cold-start niet als fout naar boven komt.
 */
/** Herkent transiente verbindingsfouten die met een reconnect-retry oplossen. */
function isRetryableConnectionError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  // P1001: kan DB niet bereiken · P1017: server heeft de verbinding gesloten.
  if (code === "P1001" || code === "P1017") return true;
  const message = String((error as Error | null)?.message ?? "");
  return /connection reset|connection closed|econnreset|kind:\s*io|kind:\s*closed|10054|server has closed the connection|terminating connection/i.test(
    message
  );
}

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Retry op transiente verbindingsfouten: maximaal 2 extra pogingen met korte
  // backoff (de engine reconnect bij de volgende poging). Niet-verbindingsfouten
  // (validatie, unique-constraints, …) worden direct doorgegooid.
  return base.$extends({
    name: "retry-on-connection-reset",
    query: {
      async $allOperations({ args, query }) {
        let lastError: unknown;
        for (let attempt = 0; attempt <= 2; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            lastError = error;
            if (attempt === 2 || !isRetryableConnectionError(error)) throw error;
            await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
          }
        }
        throw lastError;
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

const client = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = client;
}

// De retry-extensie behoudt $transaction/raw op runtime; we exporteren 'm als
// PrismaClient zodat bestaande call-sites (incl. tenant-db's $extends en
// TransactionClient-params) ongewijzigd blijven typen.
export const prisma = client as unknown as PrismaClient;
