-- Sporter-gekozen trainingsdoelen (personalisatie) + neutraal trainingsdoel-tag op templates.
-- Beide nullable → volledig backward-compatible, geen data-migratie nodig.

-- Door de sporter zélf gekozen trainingsdoelen (string[] keys uit lib/training-goals.ts).
ALTER TABLE "User" ADD COLUMN "trainingGoals" JSONB;

-- Neutraal trainingsdoel van een template (key uit lib/training-goals.ts).
ALTER TABLE "WorkoutTemplate" ADD COLUMN "goal" TEXT;
