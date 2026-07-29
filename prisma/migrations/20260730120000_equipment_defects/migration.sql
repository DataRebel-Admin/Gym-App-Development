-- Apparaatdefect melden aan de sportschool.
--
-- EquipmentDefect = melding van een lid over een defect apparaat, gericht aan
-- de trainers/het beheer van de vestiging (los van AppReport, dat naar de
-- developers gaat). Tenant-scoped + RLS conform de checklist nieuwe
-- activiteitstabel: tenantId + locationId + analytics-index
-- (tenantId, locationId, createdAt).
--
-- Bewust GEEN nieuw isOutOfService-veld op Machine: een UNSAFE-melding zet het
-- bestaande Machine.status = 'OUT_OF_SERVICE' (één bron van waarheid met het
-- onderhoudsbeheer).
--
-- DefectConfirmation = "ik zie dit ook" op een bestaande open melding (uniek
-- per lid); vanaf 3 bevestigingen gaat de severity één stap omhoog (nooit tot
-- UNSAFE — zie lib/defects.ts).
--
-- DefectQuota = rate-limit-administratie los van de melding (patroon
-- ReportQuota): ook bij een anonieme melding wordt een quota-rij mét userId
-- geschreven — zonder koppeling naar wélke melding, dus anonimiteit blijft.
--
-- User-FK's zijn ON DELETE SET NULL: accountverwijdering (AVG) anonimiseert de
-- melding automatisch. Machine-FK is SET NULL (machineLabel houdt het
-- naam-snapshot); Location is RESTRICT (vestiging met historie alleen
-- archiveerbaar, zoals elders).

CREATE TYPE "DefectStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_REPAIR', 'RESOLVED', 'REJECTED');
CREATE TYPE "DefectSeverity" AS ENUM ('MINOR', 'MAJOR', 'UNSAFE');

-- Achterstand-termijn voor de dagelijkse samenvatting (instelbaar per gym).
ALTER TABLE "Tenant" ADD COLUMN "defectReminderDays" INTEGER NOT NULL DEFAULT 7;

CREATE TABLE "EquipmentDefect" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "machineId" TEXT,
    "machineLabel" TEXT,
    "reportedById" TEXT,
    "status" "DefectStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "DefectSeverity" NOT NULL DEFAULT 'MINOR',
    "symptom" TEXT NOT NULL,
    "description" TEXT,
    "photoKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignedToId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "internalNote" TEXT,
    "duplicateOfId" TEXT,
    "digestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentDefect_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EquipmentDefect_tenantId_locationId_status_idx" ON "EquipmentDefect"("tenantId", "locationId", "status");
CREATE INDEX "EquipmentDefect_tenantId_machineId_status_idx" ON "EquipmentDefect"("tenantId", "machineId", "status");
CREATE INDEX "EquipmentDefect_tenantId_locationId_createdAt_idx" ON "EquipmentDefect"("tenantId", "locationId", "createdAt");

ALTER TABLE "EquipmentDefect" ADD CONSTRAINT "EquipmentDefect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipmentDefect" ADD CONSTRAINT "EquipmentDefect_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentDefect" ADD CONSTRAINT "EquipmentDefect_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentDefect" ADD CONSTRAINT "EquipmentDefect_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentDefect" ADD CONSTRAINT "EquipmentDefect_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentDefect" ADD CONSTRAINT "EquipmentDefect_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentDefect" ADD CONSTRAINT "EquipmentDefect_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "EquipmentDefect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DefectConfirmation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "defectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DefectConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DefectConfirmation_defectId_userId_key" ON "DefectConfirmation"("defectId", "userId");
CREATE INDEX "DefectConfirmation_tenantId_idx" ON "DefectConfirmation"("tenantId");

ALTER TABLE "DefectConfirmation" ADD CONSTRAINT "DefectConfirmation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DefectConfirmation" ADD CONSTRAINT "DefectConfirmation_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "EquipmentDefect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DefectConfirmation" ADD CONSTRAINT "DefectConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DefectQuota" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DefectQuota_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DefectQuota_userId_createdAt_idx" ON "DefectQuota"("userId", "createdAt");
CREATE INDEX "DefectQuota_tenantId_idx" ON "DefectQuota"("tenantId");

ALTER TABLE "DefectQuota" ADD CONSTRAINT "DefectQuota_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DefectQuota" ADD CONSTRAINT "DefectQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
