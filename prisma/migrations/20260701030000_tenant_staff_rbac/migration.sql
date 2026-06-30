-- Rol "Sportschoolmedewerker" (TENANT_STAFF) + permissie-gestuurd RBAC + coachnotities.

-- 1) Role-enum: nieuwe waarde TENANT_STAFF (tussen admin en member).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TENANT_STAFF' BEFORE 'TENANT_MEMBER';

-- 2) User: per-medewerker permissie-override (null = role-default).
ALTER TABLE "User" ADD COLUMN "permissions" JSONB;

-- 3) Coachnotities (tenant-scoped business-data; RLS via prisma/sql/rls.sql).
CREATE TABLE "CoachNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoachNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CoachNote_tenantId_memberId_idx" ON "CoachNote"("tenantId", "memberId");
CREATE INDEX "CoachNote_authorId_idx" ON "CoachNote"("authorId");

ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NB: RLS-policy voor CoachNote staat in prisma/sql/rls.sql en wordt apart toegepast
-- (npm run db:rls in dev; aparte deploy-stap in productie).
