-- Actieve-workout-flow: automatische 5-uur-timeout + sessie-scoped overrides
-- (overgeslagen oefeningen + gekozen alternatieven). Geen nieuw model → geen
-- RLS-wijziging (WorkoutSession is al tenant-scoped in prisma/sql/rls.sql).

ALTER TABLE "WorkoutSession"
  ADD COLUMN "autoStoppedAt" TIMESTAMP(3),
  ADD COLUMN "autoStopNotified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "overrides" JSONB;
