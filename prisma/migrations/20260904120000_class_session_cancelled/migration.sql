-- Sessie annuleren zonder verwijderen: cancelledAt bewaart de aanmeldlijst
-- (historie) terwijl de sessie niet meer boekbaar is. NULL = gaat door.
ALTER TABLE "ClassSession" ADD COLUMN "cancelledAt" TIMESTAMP(3);
