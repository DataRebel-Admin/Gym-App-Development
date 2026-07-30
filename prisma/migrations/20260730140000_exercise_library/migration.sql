-- Oefeningen-bibliotheek (RepDB) — globale contentbron naast de verouderde
-- ExerciseCatalog. Handgeschreven (shadow-db replay faalt op een historische
-- migratie), kolomnamen/constraints exact zoals Prisma ze zou genereren.
-- Alles additief; geen RLS (globale tabellen, zoals exercise_catalog).

-- CreateTable
CREATE TABLE "LibraryExercise" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "forceType" TEXT,
    "mechanic" TEXT,
    "difficulty" TEXT,
    "bodyPart" TEXT,
    "equipmentSlug" TEXT,
    "additionalEquipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "equipmentAlternatives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primaryMuscles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "secondaryMuscles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "variationGroup" TEXT,
    "isUnilateral" BOOLEAN NOT NULL DEFAULT false,
    "isBodyweight" BOOLEAN NOT NULL DEFAULT false,
    "met" DOUBLE PRECISION,
    "exerciseType" TEXT NOT NULL DEFAULT 'strength',
    "images" JSONB,
    "animation" BOOLEAN NOT NULL DEFAULT false,
    "animationType" TEXT,
    "imageAlias" TEXT,
    "retiredAt" TIMESTAMP(3),
    "datasetVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryExerciseText" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "origin" TEXT NOT NULL DEFAULT 'dataset',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryExerciseText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryMuscle" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "nameScientific" TEXT,
    "names" JSONB NOT NULL,
    "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "image" TEXT,

    CONSTRAINT "LibraryMuscle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryEquipment" (
    "id" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "image" TEXT,

    CONSTRAINT "LibraryEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryRelation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "LibraryRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryWorkoutTemplate" (
    "id" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "frequencyPerWeek" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "names" JSONB NOT NULL,
    "descriptions" JSONB NOT NULL,
    "days" JSONB NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryWorkoutTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryExercise_category_idx" ON "LibraryExercise"("category");
CREATE INDEX "LibraryExercise_bodyPart_idx" ON "LibraryExercise"("bodyPart");
CREATE INDEX "LibraryExercise_equipmentSlug_idx" ON "LibraryExercise"("equipmentSlug");
CREATE INDEX "LibraryExercise_difficulty_idx" ON "LibraryExercise"("difficulty");
CREATE UNIQUE INDEX "LibraryExerciseText_exerciseId_locale_key" ON "LibraryExerciseText"("exerciseId", "locale");
CREATE INDEX "LibraryExerciseText_locale_idx" ON "LibraryExerciseText"("locale");
CREATE UNIQUE INDEX "LibraryRelation_fromId_toId_type_key" ON "LibraryRelation"("fromId", "toId", "type");
CREATE INDEX "LibraryRelation_toId_idx" ON "LibraryRelation"("toId");

-- AddForeignKey
ALTER TABLE "LibraryExerciseText" ADD CONSTRAINT "LibraryExerciseText_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "LibraryExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryRelation" ADD CONSTRAINT "LibraryRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "LibraryExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryRelation" ADD CONSTRAINT "LibraryRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "LibraryExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: tenant-Exercise → optionele koppeling met de bibliotheek
ALTER TABLE "Exercise" ADD COLUMN "libraryId" TEXT;
CREATE INDEX "Exercise_libraryId_idx" ON "Exercise"("libraryId");
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "LibraryExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Eén externe bron per oefening: klassiek (catalogId) óf bibliotheek (libraryId),
-- nooit beide. Eigen oefening = beide NULL.
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_single_source_check" CHECK (NOT ("catalogId" IS NOT NULL AND "libraryId" IS NOT NULL));
