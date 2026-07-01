-- Slim onderhoudsbeheer voor fitnessmachines.
-- Inventaris + onderhoudsregels op Machine, historie (MaintenanceRecord) en
-- standaardregels per type (MaintenancePolicy). Alles tenant-scoped + RLS.

-- Enums
CREATE TYPE "MachineStatus" AS ENUM ('ACTIVE', 'MAINTENANCE_DUE', 'IN_MAINTENANCE', 'OUT_OF_SERVICE');
CREATE TYPE "MaintenanceKind" AS ENUM ('SERVICE', 'INSPECTION', 'SAFETY_CHECK', 'REPAIR');

-- Machine uitbreiden (allemaal nullable/gedefault → non-breaking)
ALTER TABLE "Machine" ADD COLUMN "location" TEXT;
ALTER TABLE "Machine" ADD COLUMN "serialNumber" TEXT;
ALTER TABLE "Machine" ADD COLUMN "purchaseDate" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN "status" "MachineStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Machine" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Machine" ADD COLUMN "usageThreshold" INTEGER;
ALTER TABLE "Machine" ADD COLUMN "maintenanceIntervalDays" INTEGER;
ALTER TABLE "Machine" ADD COLUMN "lastMaintenanceAt" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN "nextMaintenanceAt" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN "maintenanceDueNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN "maintenanceWarnNotifiedAt" TIMESTAMP(3);

CREATE INDEX "Machine_tenantId_status_idx" ON "Machine"("tenantId", "status");

-- Onderhoudshistorie
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "kind" "MaintenanceKind" NOT NULL DEFAULT 'SERVICE',
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "performedById" TEXT,
    "performedByName" TEXT,
    "cost" DECIMAL(10,2),
    "usageAtService" INTEGER NOT NULL DEFAULT 0,
    "nextMaintenanceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceRecord_tenantId_idx" ON "MaintenanceRecord"("tenantId");
CREATE INDEX "MaintenanceRecord_machineId_idx" ON "MaintenanceRecord"("machineId");
CREATE INDEX "MaintenanceRecord_tenantId_performedAt_idx" ON "MaintenanceRecord"("tenantId", "performedAt");

ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Standaardregels per machinetype
CREATE TABLE "MaintenancePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "machineType" "MachineType" NOT NULL,
    "usageThreshold" INTEGER,
    "intervalDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaintenancePolicy_tenantId_machineType_key" ON "MaintenancePolicy"("tenantId", "machineType");
CREATE INDEX "MaintenancePolicy_tenantId_idx" ON "MaintenancePolicy"("tenantId");

ALTER TABLE "MaintenancePolicy" ADD CONSTRAINT "MaintenancePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: zie prisma/sql/rls.sql (tenant_isolation policy) — apart toe te passen.
