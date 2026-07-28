-- Organisatie → Vestigingen (Location).
--
-- `Tenant` = de organisatie (keten); nieuw model `Location` = één fysieke
-- vestiging. Elke bestaande tenant krijgt hier één backfill-vestiging
-- "Hoofdvestiging" (isDefault, adres/openingstijden gekopieerd van de tenant —
-- het Tenant-adres blijft als facturatie-/juridisch adres). Activiteitstabellen
-- (Machine, WorkoutSession, ClassSession, MachineScan, MaintenanceRecord)
-- krijgen een VERPLICHTE locationId via het 3-staps-patroon (add nullable →
-- backfill → SET NOT NULL) met ON DELETE RESTRICT: een vestiging met historie
-- kan alleen gearchiveerd worden. Nullable: User.homeLocationId,
-- Measurement.locationId, AuditLog.locationId (geen FK — forensisch),
-- EarnedAchievement.locationId (geen FK — weergave).
--
-- `StaffLocationAccess` = expliciete medewerker↔vestiging-koppeling
-- (RESTRICTIEF, fail-closed — anders dan de additieve CoachAssignment-lens).
-- Backfill koppelt elke actieve TENANT_STAFF aan de default-vestiging zodat
-- bestaand gedrag niet verandert.
--
-- EarnedAchievement: unieke sleutel wordt [tenantId, userId, key,
-- locationScopeKey] ("" = org/global; locationId bij LOCATION-scope) zodat
-- LOCATION-trofeeën per vestiging behaalbaar zijn en createMany(skipDuplicates)
-- blijft werken.
--
-- NB: de backfill-UPDATE op WorkoutSession herschrijft de hoogste-churn-tabel
-- volledig — prima op huidige schaal, bewust in één transactionele migratie.
--
-- RLS: nieuwe tenant-tabellen Location + StaffLocationAccess → toegevoegd aan
-- prisma/sql/rls.sql; apart toe te passen met `npm run db:rls`.

-- 1. Location
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "addressLine" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "openingHours" JSONB,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Location_tenantId_name_key" ON "Location"("tenantId", "name");
CREATE UNIQUE INDEX "Location_tenantId_slug_key" ON "Location"("tenantId", "slug");
CREATE INDEX "Location_tenantId_archivedAt_idx" ON "Location"("tenantId", "archivedAt");

ALTER TABLE "Location" ADD CONSTRAINT "Location_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Backfill: één "Hoofdvestiging" per bestaande tenant (adres gekopieerd).
INSERT INTO "Location" ("id", "tenantId", "name", "addressLine", "postalCode", "city", "country",
                        "contactPhone", "contactEmail", "openingHours", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."id", 'Hoofdvestiging', t."addressLine", t."postalCode", t."city", t."country",
       t."contactPhone", t."contactEmail", t."openingHours", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenant" t;

-- 3. StaffLocationAccess + backfill actieve staff → default-vestiging.
CREATE TABLE "StaffLocationAccess" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffLocationAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffLocationAccess_tenantId_userId_locationId_key"
    ON "StaffLocationAccess"("tenantId", "userId", "locationId");
CREATE INDEX "StaffLocationAccess_tenantId_locationId_idx" ON "StaffLocationAccess"("tenantId", "locationId");
CREATE INDEX "StaffLocationAccess_tenantId_userId_idx" ON "StaffLocationAccess"("tenantId", "userId");

ALTER TABLE "StaffLocationAccess" ADD CONSTRAINT "StaffLocationAccess_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffLocationAccess" ADD CONSTRAINT "StaffLocationAccess_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffLocationAccess" ADD CONSTRAINT "StaffLocationAccess_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "StaffLocationAccess" ("id", "tenantId", "userId", "locationId", "createdAt")
SELECT gen_random_uuid()::text, u."tenantId", u."id", l."id", CURRENT_TIMESTAMP
FROM "User" u
JOIN "Location" l ON l."tenantId" = u."tenantId" AND l."isDefault"
WHERE u."role" = 'TENANT_STAFF' AND u."active" = true AND u."archivedAt" IS NULL;

-- 4. Verplichte locationId op activiteitstabellen (3-staps: add → backfill → NOT NULL).
-- 4a. Machine (staat fysiek op een vestiging).
ALTER TABLE "Machine" ADD COLUMN "locationId" TEXT;
UPDATE "Machine" m SET "locationId" = l."id"
FROM "Location" l WHERE l."tenantId" = m."tenantId" AND l."isDefault";
ALTER TABLE "Machine" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Machine_tenantId_locationId_idx" ON "Machine"("tenantId", "locationId");

-- 4b. WorkoutSession.
ALTER TABLE "WorkoutSession" ADD COLUMN "locationId" TEXT;
UPDATE "WorkoutSession" s SET "locationId" = l."id"
FROM "Location" l WHERE l."tenantId" = s."tenantId" AND l."isDefault";
ALTER TABLE "WorkoutSession" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "WorkoutSession_tenantId_locationId_startedAt_idx"
    ON "WorkoutSession"("tenantId", "locationId", "startedAt");

-- 4c. ClassSession.
ALTER TABLE "ClassSession" ADD COLUMN "locationId" TEXT;
UPDATE "ClassSession" s SET "locationId" = l."id"
FROM "Location" l WHERE l."tenantId" = s."tenantId" AND l."isDefault";
ALTER TABLE "ClassSession" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ClassSession_tenantId_locationId_startsAt_idx"
    ON "ClassSession"("tenantId", "locationId", "startsAt");

-- 4d. MachineScan (snapshot van de vestiging van de machine op scanmoment).
ALTER TABLE "MachineScan" ADD COLUMN "locationId" TEXT;
UPDATE "MachineScan" s SET "locationId" = m."locationId"
FROM "Machine" m WHERE m."id" = s."machineId";
ALTER TABLE "MachineScan" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "MachineScan" ADD CONSTRAINT "MachineScan_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "MachineScan_tenantId_locationId_scannedAt_idx"
    ON "MachineScan"("tenantId", "locationId", "scannedAt");

-- 4e. MaintenanceRecord (snapshot van de vestiging van de machine).
ALTER TABLE "MaintenanceRecord" ADD COLUMN "locationId" TEXT;
UPDATE "MaintenanceRecord" r SET "locationId" = m."locationId"
FROM "Machine" m WHERE m."id" = r."machineId";
ALTER TABLE "MaintenanceRecord" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "MaintenanceRecord_tenantId_locationId_idx" ON "MaintenanceRecord"("tenantId", "locationId");

-- 5. Nullable locatievelden.
-- 5a. User.homeLocationId (thuisvestiging; backfill = default-vestiging).
ALTER TABLE "User" ADD COLUMN "homeLocationId" TEXT;
UPDATE "User" u SET "homeLocationId" = l."id"
FROM "Location" l WHERE l."tenantId" = u."tenantId" AND l."isDefault";
ALTER TABLE "User" ADD CONSTRAINT "User_homeLocationId_fkey"
    FOREIGN KEY ("homeLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5b. Measurement.locationId (historie blijft NULL = onbekend).
ALTER TABLE "Measurement" ADD COLUMN "locationId" TEXT;
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5c. AuditLog.locationId (géén FK — forensisch, zoals tenantId).
ALTER TABLE "AuditLog" ADD COLUMN "locationId" TEXT;

-- 6. EarnedAchievement: trofee-scope (locationScopeKey in de unieke sleutel).
ALTER TABLE "EarnedAchievement"
    ADD COLUMN "locationId" TEXT,
    ADD COLUMN "locationScopeKey" TEXT NOT NULL DEFAULT '';
DROP INDEX "EarnedAchievement_tenantId_userId_key_key";
CREATE UNIQUE INDEX "EarnedAchievement_tenantId_userId_key_locationScopeKey_key"
    ON "EarnedAchievement"("tenantId", "userId", "key", "locationScopeKey");
