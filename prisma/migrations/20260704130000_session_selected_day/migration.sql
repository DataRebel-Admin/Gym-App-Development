-- Gekozen trainingsdag per sessie: je doet één dag per keer. NULL = heel schema
-- / één-dag-schema (backward compatible). Geen FK → overleeft dagwijzigingen.
-- WorkoutSession is al tenant-scoped (geen RLS-wijziging nodig).

ALTER TABLE "WorkoutSession"
  ADD COLUMN "dayId" TEXT;
