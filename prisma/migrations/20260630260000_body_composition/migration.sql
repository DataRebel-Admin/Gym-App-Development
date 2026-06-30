-- CreateEnum
CREATE TYPE "MeasurementSource" AS ENUM ('MANUAL', 'INBODY', 'TANITA', 'EVOLT', 'GARMIN', 'APPLE_HEALTH', 'GOOGLE_FIT');
CREATE TYPE "PhotoPose" AS ENUM ('FRONT', 'SIDE', 'BACK');
CREATE TYPE "GoalMetric" AS ENUM ('WEIGHT', 'BODY_FAT', 'MUSCLE_MASS', 'BMI', 'WAIST');

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordedById" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "source" "MeasurementSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "raw" JSONB,
    "weightKg" DOUBLE PRECISION,
    "bodyFatPct" DOUBLE PRECISION,
    "muscleMassKg" DOUBLE PRECISION,
    "fatMassKg" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "waterPct" DOUBLE PRECISION,
    "boneMassKg" DOUBLE PRECISION,
    "visceralFat" DOUBLE PRECISION,
    "bmr" INTEGER,
    "metabolicAge" INTEGER,
    "chestCm" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipsCm" DOUBLE PRECISION,
    "neckCm" DOUBLE PRECISION,
    "armLeftCm" DOUBLE PRECISION,
    "armRightCm" DOUBLE PRECISION,
    "thighLeftCm" DOUBLE PRECISION,
    "thighRightCm" DOUBLE PRECISION,
    "calfLeftCm" DOUBLE PRECISION,
    "calfRightCm" DOUBLE PRECISION,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementPhoto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "measurementId" TEXT NOT NULL,
    "pose" "PhotoPose" NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeasurementPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberGoal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metric" "GoalMetric" NOT NULL,
    "startValue" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "targetDate" TIMESTAMP(3),
    "createdById" TEXT,
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Measurement_tenantId_idx" ON "Measurement"("tenantId");
CREATE INDEX "Measurement_userId_measuredAt_idx" ON "Measurement"("userId", "measuredAt");
CREATE INDEX "MeasurementPhoto_tenantId_idx" ON "MeasurementPhoto"("tenantId");
CREATE INDEX "MeasurementPhoto_measurementId_idx" ON "MeasurementPhoto"("measurementId");
CREATE INDEX "MemberGoal_tenantId_idx" ON "MemberGoal"("tenantId");
CREATE INDEX "MemberGoal_userId_metric_idx" ON "MemberGoal"("userId", "metric");

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeasurementPhoto" ADD CONSTRAINT "MeasurementPhoto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeasurementPhoto" ADD CONSTRAINT "MeasurementPhoto_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberGoal" ADD CONSTRAINT "MemberGoal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberGoal" ADD CONSTRAINT "MemberGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
