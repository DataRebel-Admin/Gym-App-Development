-- Groepslessen v2: wachtlijst, capaciteit per sessie, herhaalreeksen en
-- idempotente herinneringen. Alles additief; bestaande rijen blijven geldig.

-- Wachtlijst: een aanmelding op een volle les wacht op een vrijgekomen plek.
ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'WAITLISTED';

-- Capaciteit per sessie (null = les-default) + herhaalreeks + createdAt.
ALTER TABLE "ClassSession"
  ADD COLUMN "maxParticipants" INTEGER,
  ADD COLUMN "seriesId" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "ClassSession_seriesId_idx" ON "ClassSession"("seriesId");

-- Herinnering-marker (cron), zodat een lid nooit twee keer herinnerd wordt.
ALTER TABLE "ClassEnrollment"
  ADD COLUMN "remindedAt" TIMESTAMP(3);
