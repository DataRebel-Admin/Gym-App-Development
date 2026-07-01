-- Centraal Feature Flag-systeem: module aan/uit per tenant (Superadmin-beheerd).
-- Eén rij per (tenant, key); ontbreekt een rij, dan geldt de code-default uit
-- lib/features/catalog.ts. Tenant-scoped + RLS.

CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedById" TEXT,
    "updatedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureFlag_tenantId_key_key" ON "FeatureFlag"("tenantId", "key");
CREATE INDEX "FeatureFlag_tenantId_idx" ON "FeatureFlag"("tenantId");

ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: zie prisma/sql/rls.sql (tenant_isolation policy) — apart toe te passen.
