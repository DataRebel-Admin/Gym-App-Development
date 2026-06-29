-- Per-oefening streefgewicht + opmerking in een schema.
ALTER TABLE "WorkoutExerciseItem" ADD COLUMN "weightKg" DOUBLE PRECISION;
ALTER TABLE "WorkoutExerciseItem" ADD COLUMN "notes" TEXT;
