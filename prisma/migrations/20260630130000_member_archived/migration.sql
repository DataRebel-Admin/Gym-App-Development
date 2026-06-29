-- Gearchiveerde leden: uit de actieve roster zonder te verwijderen.
ALTER TABLE "User" ADD COLUMN "archivedAt" TIMESTAMP(3);
