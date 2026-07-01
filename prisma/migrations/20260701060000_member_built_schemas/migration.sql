-- Zelf-gebouwde lid-schema's: leden stellen zelf een trainingsschema samen,
-- binnen door de sportschool ingestelde kaders en met optionele goedkeuring.
--
-- Additief en backward-compatible: bestaande (coach-)schema's houden
-- origin=COACH en memberStatus=NULL; bestaande tenants staan op DISABLED.

-- 1) Nieuwe enums.
CREATE TYPE "MemberSchemaMode" AS ENUM ('DISABLED', 'APPROVAL', 'DIRECT');
CREATE TYPE "AssignmentOrigin" AS ENUM ('COACH', 'MEMBER');
CREATE TYPE "MemberSchemaStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'PAUSED');

-- 2) Tenant: mate van controle over zelf-gebouwde lid-schema's (opt-in).
ALTER TABLE "Tenant" ADD COLUMN "memberSchemaMode" "MemberSchemaMode" NOT NULL DEFAULT 'DISABLED';

-- 3) WorkoutTemplate: vrijgeven als lid-startsjabloon.
ALTER TABLE "WorkoutTemplate" ADD COLUMN "memberVisible" BOOLEAN NOT NULL DEFAULT false;

-- 4) AssignedWorkout: lid-levenscyclus (los van de zichtbaarheids-`status`).
ALTER TABLE "AssignedWorkout" ADD COLUMN "origin" "AssignmentOrigin" NOT NULL DEFAULT 'COACH';
ALTER TABLE "AssignedWorkout" ADD COLUMN "memberStatus" "MemberSchemaStatus";
ALTER TABLE "AssignedWorkout" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "AssignedWorkout" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "AssignedWorkout" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "AssignedWorkout" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "AssignedWorkout" ADD COLUMN "goal" "SchemaRequestGoal";
ALTER TABLE "AssignedWorkout" ADD COLUMN "focusNote" TEXT;
ALTER TABLE "AssignedWorkout" ADD COLUMN "frameworkId" TEXT;
CREATE INDEX "AssignedWorkout_tenantId_origin_memberStatus_idx"
  ON "AssignedWorkout"("tenantId", "origin", "memberStatus");

-- 5) SchemaFramework: kaders waarbinnen een lid mag samenstellen.
CREATE TABLE "SchemaFramework" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "allowedExerciseIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "allowedTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "minDays" INTEGER,
    "maxDays" INTEGER,
    "minExercisesPerDay" INTEGER,
    "maxExercisesPerDay" INTEGER,
    "setsMin" INTEGER,
    "setsMax" INTEGER,
    "repsMin" INTEGER,
    "repsMax" INTEGER,
    "restMin" INTEGER,
    "restMax" INTEGER,
    "requireApproval" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchemaFramework_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SchemaFramework_tenantId_idx" ON "SchemaFramework"("tenantId");
ALTER TABLE "SchemaFramework" ADD CONSTRAINT "SchemaFramework_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6) MemberFrameworkAssignment: kader ↔ lid (max één per lid).
CREATE TABLE "MemberFrameworkAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberFrameworkAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemberFrameworkAssignment_tenantId_memberId_key"
  ON "MemberFrameworkAssignment"("tenantId", "memberId");
CREATE INDEX "MemberFrameworkAssignment_tenantId_frameworkId_idx"
  ON "MemberFrameworkAssignment"("tenantId", "frameworkId");
ALTER TABLE "MemberFrameworkAssignment" ADD CONSTRAINT "MemberFrameworkAssignment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberFrameworkAssignment" ADD CONSTRAINT "MemberFrameworkAssignment_frameworkId_fkey"
  FOREIGN KEY ("frameworkId") REFERENCES "SchemaFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NB: RLS-policies voor SchemaFramework + MemberFrameworkAssignment staan in
-- prisma/sql/rls.sql (npm run db:rls in dev; aparte deploy-stap in productie).
