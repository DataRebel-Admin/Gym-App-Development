-- Trainingsschema's: levenscyclus (concept/gepland/gepubliceerd) + planning +
-- persoonlijke boodschap + "Nieuw"-indicator, plus web-push-abonnementen.

-- 1) Levenscyclus-enum.
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- 2) Lifecycle-velden op AssignedWorkout. Bestaande toewijzingen zijn live →
--    default PUBLISHED; publishedAt backfillen naar createdAt zodat het
--    owner-overzicht een publicatiedatum heeft.
ALTER TABLE "AssignedWorkout"
  ADD COLUMN "status" "AssignmentStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "availableFrom" TIMESTAMP(3),
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "endDate" TIMESTAMP(3),
  ADD COLUMN "trainerMessage" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "assignedById" TEXT,
  ADD COLUMN "notifiedAt" TIMESTAMP(3),
  ADD COLUMN "seenAt" TIMESTAMP(3);

UPDATE "AssignedWorkout" SET "publishedAt" = "createdAt" WHERE "publishedAt" IS NULL;

CREATE INDEX "AssignedWorkout_tenantId_userId_status_idx" ON "AssignedWorkout"("tenantId", "userId", "status");
CREATE INDEX "AssignedWorkout_status_availableFrom_idx" ON "AssignedWorkout"("status", "availableFrom");

-- 3) Web-push-abonnementen.
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_tenantId_idx" ON "PushSubscription"("tenantId");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
