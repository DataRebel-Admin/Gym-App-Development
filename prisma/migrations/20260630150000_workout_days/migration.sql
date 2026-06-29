-- Multi-dag schema's: schema → dagen → oefeningen.

-- 1) Nieuwe tabel WorkoutDay.
CREATE TABLE "WorkoutDay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL DEFAULT 'Dag 1',
    CONSTRAINT "WorkoutDay_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkoutDay_tenantId_idx" ON "WorkoutDay"("tenantId");
CREATE INDEX "WorkoutDay_templateId_idx" ON "WorkoutDay"("templateId");
ALTER TABLE "WorkoutDay" ADD CONSTRAINT "WorkoutDay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkoutDay" ADD CONSTRAINT "WorkoutDay_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) dayId op items.
ALTER TABLE "WorkoutExerciseItem" ADD COLUMN "dayId" TEXT;

-- 3) Backfill: één 'Dag 1' per schema dat oefeningen heeft, items eraan koppelen.
INSERT INTO "WorkoutDay" ("id", "tenantId", "templateId", "order", "name")
SELECT gen_random_uuid()::text, t."tenantId", t."id", 0, 'Dag 1'
FROM "WorkoutTemplate" t
WHERE EXISTS (SELECT 1 FROM "WorkoutExerciseItem" i WHERE i."templateId" = t."id");

UPDATE "WorkoutExerciseItem" i
SET "dayId" = d."id"
FROM "WorkoutDay" d
WHERE d."templateId" = i."templateId";

-- 4) FK + index voor dayId.
CREATE INDEX "WorkoutExerciseItem_dayId_idx" ON "WorkoutExerciseItem"("dayId");
ALTER TABLE "WorkoutExerciseItem" ADD CONSTRAINT "WorkoutExerciseItem_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "WorkoutDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
