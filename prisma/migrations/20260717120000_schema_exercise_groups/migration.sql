-- Feilloos schema's maken: groeperen (superset/giant/circuit/AMRAP), dropsets,
-- en een per-lid coach-notitie per oefening. Alle velden op het bestaande
-- WorkoutExerciseItem (vlak, geen nieuw model) → WorkoutExerciseItem is al
-- tenant-scoped in prisma/sql/rls.sql, dus geen RLS-wijziging nodig.

ALTER TABLE "WorkoutExerciseItem"
  ADD COLUMN "memberNote" TEXT,
  ADD COLUMN "groupId" TEXT,
  ADD COLUMN "groupType" TEXT,
  ADD COLUMN "groupOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "groupRounds" INTEGER,
  ADD COLUMN "groupRestSeconds" INTEGER,
  ADD COLUMN "groupLabel" TEXT,
  ADD COLUMN "groupTimeCapSeconds" INTEGER,
  ADD COLUMN "dropsetCount" INTEGER;
