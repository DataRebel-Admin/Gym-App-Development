-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "catalogId" TEXT;

-- CreateTable
CREATE TABLE "exercise_catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "body_part" TEXT NOT NULL,
    "equipment" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "muscle_group" TEXT,
    "secondary_muscles" TEXT[],
    "instructions" JSONB NOT NULL,
    "instruction_steps" JSONB,
    "image_url" TEXT NOT NULL,
    "gif_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exercise_catalog_category_idx" ON "exercise_catalog"("category");

-- CreateIndex
CREATE INDEX "exercise_catalog_equipment_idx" ON "exercise_catalog"("equipment");

-- CreateIndex
CREATE INDEX "exercise_catalog_target_idx" ON "exercise_catalog"("target");

-- CreateIndex
CREATE INDEX "Exercise_catalogId_idx" ON "Exercise"("catalogId");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "exercise_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
