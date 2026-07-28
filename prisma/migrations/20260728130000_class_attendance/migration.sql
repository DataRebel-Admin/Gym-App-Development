-- Aanwezigheid & no-shows op les-aanmeldingen (ClassEnrollment).
--
-- Uitschrijven wordt een status-overgang (ENROLLED → CANCELLED) i.p.v. een hard
-- delete, zodat no-show-/aanwezigheidsanalytics mogelijk worden. Capaciteit telt
-- voortaan alleen ENROLLED + ATTENDED (zie lib/class-attendance.ts). ATTENDED/
-- NO_SHOW worden ná de les gezet door staff (aanwezigheidspaneel) of de
-- no-show-cron (12u na endsAt).
--
-- Backfill: aanmeldingen van reeds afgelopen sessies → ATTENDED. Er bestaat
-- geen historische aanwezigheidsdata; deze goedaardige aanname voorkomt dat de
-- cron alle historie met terugwerkende kracht als no-show markeert en de
-- retentie-/no-show-metrics vanaf dag één vervuilt.
--
-- ClassEnrollment is al tenant-scoped → geen RLS-wijziging nodig.

CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

ALTER TABLE "ClassEnrollment"
    ADD COLUMN "status" "EnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    ADD COLUMN "statusChangedAt" TIMESTAMP(3),
    ADD COLUMN "markedById" TEXT;

UPDATE "ClassEnrollment" e SET "status" = 'ATTENDED'
FROM "ClassSession" s
WHERE s."id" = e."sessionId" AND s."endsAt" < CURRENT_TIMESTAMP;

CREATE INDEX "ClassEnrollment_sessionId_status_idx" ON "ClassEnrollment"("sessionId", "status");
