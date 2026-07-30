-- Koppeling tenant-WorkoutTemplate ← LibraryWorkoutTemplate (RepDB-voorbeeld-
-- schema's): maakt "kopieer naar mijn schema's" idempotent en toont "Toegevoegd".
ALTER TABLE "WorkoutTemplate" ADD COLUMN "libraryTemplateId" TEXT;
CREATE INDEX "WorkoutTemplate_libraryTemplateId_idx" ON "WorkoutTemplate"("libraryTemplateId");
ALTER TABLE "WorkoutTemplate" ADD CONSTRAINT "WorkoutTemplate_libraryTemplateId_fkey" FOREIGN KEY ("libraryTemplateId") REFERENCES "LibraryWorkoutTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
