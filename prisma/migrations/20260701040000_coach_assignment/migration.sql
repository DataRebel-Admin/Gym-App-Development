-- Coach↔lid-koppeling: een coach (medewerker/eigenaar) begeleidt leden.

CREATE TABLE "CoachAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CoachAssignment_tenantId_coachId_memberId_key"
  ON "CoachAssignment"("tenantId", "coachId", "memberId");
CREATE INDEX "CoachAssignment_tenantId_coachId_idx" ON "CoachAssignment"("tenantId", "coachId");
CREATE INDEX "CoachAssignment_tenantId_memberId_idx" ON "CoachAssignment"("tenantId", "memberId");

ALTER TABLE "CoachAssignment" ADD CONSTRAINT "CoachAssignment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachAssignment" ADD CONSTRAINT "CoachAssignment_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachAssignment" ADD CONSTRAINT "CoachAssignment_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NB: RLS-policy staat in prisma/sql/rls.sql (npm run db:rls in dev; aparte deploy-stap prod).
