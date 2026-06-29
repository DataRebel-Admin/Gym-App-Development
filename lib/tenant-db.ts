import "server-only";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

/**
 * Tenant-scoped Prisma client voor alle tenant-business-data.
 *
 * Elke model-operatie wordt in één transactie uitgevoerd waarin eerst de
 * Postgres-GUC `app.current_tenant` (transaction-local) wordt gezet. De
 * RLS-policies in `prisma/migrations/manual/rls.sql` filteren daarmee
 * automatisch op de actieve tenant — defense-in-depth bovenop het feit dat we
 * ook expliciet op `tenantId` queryen.
 *
 * De single-transaction set_config-aanpak werkt ook met Neon's connection
 * pooler (transaction mode), omdat de SET en de query dezelfde transactie —
 * en dus dezelfde server-connectie — delen.
 *
 * Let op: ruwe queries ($queryRaw) en eigen $transaction-aanroepen vallen
 * buiten deze extensie; gebruik daar handmatig set_config indien nodig.
 */
export function tenantDbFor(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

/** Tenant-scoped client voor de actieve request-tenant. */
export async function getTenantDb() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    throw new Error("Geen actieve tenant in de request-context.");
  }
  return tenantDbFor(tenant.id);
}
