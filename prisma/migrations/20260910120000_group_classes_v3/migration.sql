-- Groepslessen v3: instructeur als gebruiker, boekingsregels, lestype
-- archiveren en een omslagfoto per lestype.
--
-- Alles additief en nullable/defaulted → bestaande rijen en bestaand gedrag
-- blijven ongewijzigd. Geen nieuwe tabel, dus geen RLS-wijziging
-- (prisma/sql/rls.sql dekt GroupClass/ClassSession/ClassEnrollment al).

-- Lestype: omslagfoto, vaste instructeur, eigen boekingsregels (NULL = volg de
-- sportschool-standaard op Tenant) en archiveren i.p.v. verwijderen.
ALTER TABLE "GroupClass"
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "defaultInstructorId" TEXT,
  ADD COLUMN "cancelDeadlineMinutes" INTEGER,
  ADD COLUMN "bookingOpensDays" INTEGER,
  ADD COLUMN "maxBookingsPerWeek" INTEGER,
  ADD COLUMN "remindHoursBefore" INTEGER,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "GroupClass_defaultInstructorId_idx" ON "GroupClass"("defaultInstructorId");

ALTER TABLE "GroupClass"
  ADD CONSTRAINT "GroupClass_defaultInstructorId_fkey"
  FOREIGN KEY ("defaultInstructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sessie: wie geeft deze les. Op de sessie en niet op het lestype, omdat een
-- vervanger per sessie geregeld wordt.
ALTER TABLE "ClassSession" ADD COLUMN "instructorId" TEXT;

CREATE INDEX "ClassSession_tenantId_instructorId_startsAt_idx"
  ON "ClassSession"("tenantId", "instructorId", "startsAt");

ALTER TABLE "ClassSession"
  ADD CONSTRAINT "ClassSession_instructorId_fkey"
  FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sportschool-standaard voor de boekingsregels. De defaults zijn precies het
-- gedrag van vóór deze migratie: afmelden tot de start, ruime boekingshorizon,
-- geen weeklimiet, geen no-show-beleid.
ALTER TABLE "Tenant"
  ADD COLUMN "classCancelDeadlineMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "classBookingOpensDays" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "classMaxBookingsPerWeek" INTEGER,
  ADD COLUMN "classNoShowLimit" INTEGER,
  ADD COLUMN "classRemindHoursBefore" INTEGER NOT NULL DEFAULT 14;
