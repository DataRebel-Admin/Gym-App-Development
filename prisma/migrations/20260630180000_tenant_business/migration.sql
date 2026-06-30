-- Tenant-instellingen: zakelijke gegevens (contact, adres, BTW/KvK, social, openingstijden).
ALTER TABLE "Tenant" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "addressLine" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "city" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "country" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "website" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "vatNumber" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "cocNumber" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "socials" JSONB;
ALTER TABLE "Tenant" ADD COLUMN "openingHours" JSONB;
