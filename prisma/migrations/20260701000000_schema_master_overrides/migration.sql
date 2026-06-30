-- Master template + persoonlijke kopie (3-weg-diff) en coachingvelden.
--
-- Schemabeheer wordt een coachingtool: één master als bron van waarheid, per-lid
-- gepersonaliseerde kopie, en een baseline-snapshot om master-wijzigingen te
-- detecteren/synchroniseren. Coach-notities op 3 niveaus + tempo per oefening.
-- Herbruikbare dagtemplates via WorkoutTemplate.kind = DAY. Geen nieuwe tabellen.

-- Soort herbruikbare template: volledig schema of losse trainingsdag.
CREATE TYPE "WorkoutTemplateKind" AS ENUM ('SCHEMA', 'DAY');

-- WorkoutTemplate: discriminator + coach-notitie op schema-niveau.
ALTER TABLE "WorkoutTemplate" ADD COLUMN "kind" "WorkoutTemplateKind" NOT NULL DEFAULT 'SCHEMA';
ALTER TABLE "WorkoutTemplate" ADD COLUMN "coachNote" TEXT;

-- WorkoutDay: coach-notitie op dag-niveau.
ALTER TABLE "WorkoutDay" ADD COLUMN "notes" TEXT;

-- WorkoutExerciseItem: tempo-cadans per oefening (bv. "3-1-1").
ALTER TABLE "WorkoutExerciseItem" ADD COLUMN "tempo" TEXT;

-- AssignedWorkout: baseline-snapshot van de master op koppel-/sync-moment +
-- laatst erkende master-staat (stuurt de "Sync beschikbaar"-banner aan).
ALTER TABLE "AssignedWorkout" ADD COLUMN "baselineSnapshot" JSONB;
ALTER TABLE "AssignedWorkout" ADD COLUMN "masterSyncedAt" TIMESTAMP(3);
