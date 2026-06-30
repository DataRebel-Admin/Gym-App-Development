-- Accountinstellingen: meldingsvoorkeuren, privacy-toestemmingen, verwijderverzoek.
ALTER TABLE "User" ADD COLUMN "notificationPrefs" JSONB;
ALTER TABLE "User" ADD COLUMN "consents" JSONB;
ALTER TABLE "User" ADD COLUMN "deletionRequestedAt" TIMESTAMP(3);
