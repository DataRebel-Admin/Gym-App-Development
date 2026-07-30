-- Eigen omslagfoto per trainingsschema.
--
-- Additief en nullable: bestaande schema's blijven werken en krijgen hun beeld
-- via de terugval in lib/schema-image.ts (herkomst-voorbeeldschema → logo).
-- Geen RLS-wijziging: "WorkoutTemplate" is al tenant-scoped.
ALTER TABLE "WorkoutTemplate" ADD COLUMN "imageUrl" TEXT;
