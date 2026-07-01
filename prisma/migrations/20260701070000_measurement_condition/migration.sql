-- Conditie-metric: rusthartslag (bpm). Nullable → geen data-migratie nodig.
-- Onderdeel van het inclusiever maken van de Body Composition-module: voortgang
-- is méér dan lichaamssamenstelling alleen (ook conditie).
ALTER TABLE "Measurement" ADD COLUMN "restingHrBpm" INTEGER;
