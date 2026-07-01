-- Motiverende premium features voor sporters.
--
-- Additieve, backward-compatible kolommen op bestaande RLS-tabellen (nieuwe
-- kolommen vallen onder de bestaande row-policies → geen wijziging in rls.sql):
--
--  * WorkoutSession.mood        — Workout Mood (trainingsbeleving, one-tap na
--                                 afronden). NULL = niet gekozen. Key uit
--                                 lib/workout-moods.ts.
--  * WorkoutTemplate.badges     — vrij toewijsbare schema-badges (keys uit
--                                 lib/schema-badges.ts). Default lege array.
--  * Tenant.quotesEnabled       — Workout Quotes aan/uit per sportschool.
--  * Tenant.customQuotes        — eigen quotes van de owner (JSON-array strings).
--
-- User.preferences (bestaande Json-kolom) draagt de favoriet-oefeningen en de
-- nieuwe `hideQuotes`-voorkeur → geen kolomwijziging nodig.

ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "mood" TEXT;

ALTER TABLE "WorkoutTemplate" ADD COLUMN IF NOT EXISTS "badges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "quotesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "customQuotes" JSONB;
