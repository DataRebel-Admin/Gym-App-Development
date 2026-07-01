-- Geldigheid van een schema in weken.
--
-- Een schema (library-template) kan een geldigheidsduur in weken hebben. Die
-- wordt meegekloond naar elk toegewezen lid-schema, zodat per lid berekend kan
-- worden of het schema nog geldig is, bijna verloopt ("Nieuw schema nodig") of
-- verlopen is ("Verlopen") — zie lib/schema-status.ts (computeValidity).
--
-- Additief en backward-compatible: bestaande schema's krijgen NULL (= onbeperkt
-- geldig, geen verloop-flag).

ALTER TABLE "WorkoutTemplate" ADD COLUMN IF NOT EXISTS "validityWeeks" INTEGER;
