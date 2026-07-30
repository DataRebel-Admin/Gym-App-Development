-- Creatietijdstip op WorkoutSession.
--
-- `startedAt` is géén betrouwbaar herkomst-signaal: de seed fabriceert historie
-- door sessies terug te dateren, én genereert voor de huidige dag willekeurige
-- tijdstippen die ná de seedrun kunnen liggen. De seed-bescherming
-- (prisma/seed-guard.ts) kon een gefabriceerde sessie daardoor niet van een
-- echt getrainde sessie onderscheiden en sloeg vals alarm.
--
-- Backfill: bestaande rijen krijgen hun trainingsmoment als creatietijdstip —
-- de best beschikbare benadering. Nieuwe rijen krijgen het echte moment.
--
-- WorkoutSession is al tenant-scoped → geen RLS-wijziging nodig.

ALTER TABLE "WorkoutSession"
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "WorkoutSession" SET "createdAt" = "startedAt";
