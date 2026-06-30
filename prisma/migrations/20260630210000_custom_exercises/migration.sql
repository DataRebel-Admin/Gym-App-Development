-- CreateEnum
CREATE TYPE "ExerciseDifficulty" AS ENUM ('BEGINNER', 'GEMIDDELD', 'GEVORDERD');

-- AlterTable: eigen-oefening content op tenant-Exercise (nullable → bestaande rijen ongemoeid)
ALTER TABLE "Exercise" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "category" TEXT,
ADD COLUMN     "coachingTipsMd" TEXT,
ADD COLUMN     "commonMistakesMd" TEXT,
ADD COLUMN     "difficulty" "ExerciseDifficulty",
ADD COLUMN     "equipment" TEXT,
ADD COLUMN     "executionMd" TEXT,
ADD COLUMN     "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "muscleGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notesMd" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "videoUrl" TEXT;
