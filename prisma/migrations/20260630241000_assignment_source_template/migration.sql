-- Herkomst van een toegewezen schema: de library-template waaruit het is
-- gekloond. Maakt het owner-overzicht "aan welke leden is dit schema toegewezen"
-- mogelijk (de lid-kloon zelf heeft geen FK naar de bron).
ALTER TABLE "AssignedWorkout" ADD COLUMN "sourceTemplateId" TEXT;
CREATE INDEX "AssignedWorkout_sourceTemplateId_idx" ON "AssignedWorkout"("sourceTemplateId");
