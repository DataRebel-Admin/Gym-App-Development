-- QR-scan-tracking voor apparaten. Gedenormaliseerde teller op Machine (goedkoop
-- tonen) + logmodel MachineScan (trends: scans deze week, populairste apparaten).
-- MachineScan is tenant-scoped + RLS (zie prisma/sql/rls.sql).

-- Teller + laatste scanmoment op Machine.
ALTER TABLE "Machine" ADD COLUMN "scanCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Machine" ADD COLUMN "lastScannedAt" TIMESTAMP(3);

-- Eén rij per scan.
CREATE TABLE "MachineScan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "MachineScan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MachineScan_tenantId_idx" ON "MachineScan"("tenantId");
CREATE INDEX "MachineScan_machineId_scannedAt_idx" ON "MachineScan"("machineId", "scannedAt");
CREATE INDEX "MachineScan_tenantId_scannedAt_idx" ON "MachineScan"("tenantId", "scannedAt");

ALTER TABLE "MachineScan" ADD CONSTRAINT "MachineScan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineScan" ADD CONSTRAINT "MachineScan_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineScan" ADD CONSTRAINT "MachineScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: zie prisma/sql/rls.sql (tenant_isolation policy) — apart toe te passen.
