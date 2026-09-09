-- Schema's afwisselen + eenmalige workouts: een trainingssessie legt vast uit
-- welk schema hij draait, los van wat op dat moment het actieve schema is.
-- Beide kolommen zijn additief op de al tenant-scoped WorkoutSession → geen
-- RLS-wijziging nodig.

-- Het schema (WorkoutTemplate.id) van de sessie. Geen FK (zoals dayId): een
-- verwijderd schema laat de historie intact. NULL = sessie van vóór dit veld,
-- die valt read-time terug op het actieve schema.
ALTER TABLE "WorkoutSession" ADD COLUMN "templateId" TEXT;

-- Eenmalige workout (catalogus of niet-actief schema) — verandert het actieve
-- schema niet en telt in de agenda niet als geplande schemadag.
ALTER TABLE "WorkoutSession" ADD COLUMN "oneOff" BOOLEAN NOT NULL DEFAULT false;
