-- Per-tenant lesrooster-schakelaar + configureerbare meetvelden.
-- Beide op Tenant (geen RLS op Tenant). classesEnabled default true = geen
-- gedragswijziging voor bestaande tenants; enabledMeasurementFields NULL = alle
-- meetvelden actief (backward-compat).
ALTER TABLE "Tenant" ADD COLUMN "classesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN "enabledMeasurementFields" JSONB;
