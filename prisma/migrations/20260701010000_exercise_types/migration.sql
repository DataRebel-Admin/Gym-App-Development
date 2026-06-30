-- Slimme oefeningen: oefeningstypes + dynamische parameters.
--
-- Elke oefening krijgt een `exerciseType` (code-registry, lib/exercise-types.ts)
-- dat bepaalt wélke parameters relevant zijn. Type-specifieke waarden die niet op
-- een bestaande kolom mappen (sets/reps/restSeconds/weightKg/tempo) leven in een
-- `params` JSON-kolom op het schema-item en de prestatie-entry.
--
-- Volledig additief en backward-compatible: bestaande rijen krijgen
-- exerciseType = 'strength' en params = NULL → bestaande kracht-leessites
-- (sets/reps/weightKg) blijven ongewijzigd werken.

-- Oefeningstype (String, geen enum → nieuw type vereist geen DB-migratie).
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "exerciseType" TEXT NOT NULL DEFAULT 'strength';

-- Type-specifieke doel-parameters per schema-item.
ALTER TABLE "WorkoutExerciseItem" ADD COLUMN IF NOT EXISTS "params" JSONB;

-- Type-specifieke logwaarden per prestatie-entry.
ALTER TABLE "PerformanceEntry" ADD COLUMN IF NOT EXISTS "params" JSONB;
