-- Accountinstellingen: profielvelden + e-mailwijziging-verificatie.
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "timezone" TEXT;
ALTER TABLE "User" ADD COLUMN "locale" "Locale";
ALTER TABLE "User" ADD COLUMN "preferences" JSONB;
ALTER TABLE "User" ADD COLUMN "pendingEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "emailChangeToken" TEXT;
ALTER TABLE "User" ADD COLUMN "emailChangeExpires" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_emailChangeToken_key" ON "User"("emailChangeToken");
