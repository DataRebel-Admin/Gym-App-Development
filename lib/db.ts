import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. In development bewaart Next.js modules tussen
 * hot-reloads; zonder singleton zou elke reload een nieuwe client + connectie
 * openen en de database-verbindingen uitputten.
 *
 * In prompt 04 wordt deze uitgebreid zodat elke query de tenant-context zet
 * (`SET app.current_tenant = '<slug>'`) t.b.v. row-level security.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
