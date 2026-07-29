-- Probleem melden aan de developers (app-meldingen).
--
-- AppReport = meldingen over de app zélf (bugs/feedback/vragen), niet over
-- apparatuur. Globale platform-tabel zoals AuditLog: bewust GEEN FK's
-- (forensisch — een melding blijft bestaan na verwijdering van tenant/user;
-- de AVG-verwijderflow nult alleen reportedById) en géén tenantId-RLS
-- (alleen de superadmin leest, schrijven gaat via POST /api/reports met de
-- base prisma).
--
-- ReportQuota = rate-limit-administratie los van de inhoud: bij een anonieme
-- melding wordt wél een quota-rij met userId geschreven (zonder koppeling naar
-- wélke melding — anonimiteit blijft), zodat de daglimiet ook anoniem geldt.
-- ipHash = HMAC-SHA256(AUTH_SECRET, ip) voor niet-ingelogde submits; het ruwe
-- IP wordt nergens opgeslagen.

CREATE TYPE "ReportType" AS ENUM ('BUG', 'FEEDBACK', 'QUESTION');
CREATE TYPE "ReportStatus" AS ENUM ('NEW', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'WONTFIX', 'DUPLICATE');
CREATE TYPE "ReportSeverity" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'BLOCKER');

CREATE TABLE "AppReport" (
    "id" TEXT NOT NULL,
    "type" "ReportType" NOT NULL DEFAULT 'BUG',
    "status" "ReportStatus" NOT NULL DEFAULT 'NEW',
    "severity" "ReportSeverity" NOT NULL DEFAULT 'NORMAL',
    "reportedById" TEXT,
    "reporterRole" TEXT,
    "tenantId" TEXT,
    "locationId" TEXT,
    "contactAllowed" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "screenshotKey" TEXT,
    "route" TEXT,
    "appVersion" TEXT,
    "buildId" TEXT,
    "platform" TEXT,
    "osVersion" TEXT,
    "device" TEXT,
    "screenSize" TEXT,
    "userAgent" TEXT,
    "locale" TEXT,
    "clientErrors" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duplicateOfId" TEXT,
    "externalRef" TEXT,
    "internalNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppReport_status_createdAt_idx" ON "AppReport"("status", "createdAt");
CREATE INDEX "AppReport_appVersion_platform_idx" ON "AppReport"("appVersion", "platform");
CREATE INDEX "AppReport_tenantId_idx" ON "AppReport"("tenantId");
CREATE INDEX "AppReport_route_createdAt_idx" ON "AppReport"("route", "createdAt");
CREATE INDEX "AppReport_createdAt_idx" ON "AppReport"("createdAt");

CREATE TABLE "ReportQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportQuota_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportQuota_userId_createdAt_idx" ON "ReportQuota"("userId", "createdAt");
CREATE INDEX "ReportQuota_ipHash_createdAt_idx" ON "ReportQuota"("ipHash", "createdAt");
