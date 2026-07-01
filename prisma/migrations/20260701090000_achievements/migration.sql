-- Trophy/Achievement/Milestones-systeem.
-- Opt-in per sportschool + behaalde achievements per lid (tenant-scoped + RLS).

-- Opt-in-vlag op de tenant (naast aiEnabled).
ALTER TABLE "Tenant" ADD COLUMN "achievementsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Behaalde trofeeën/mijlpalen. Definities zijn code-gestuurd; hier alleen wélke +
-- wanneer. Unique voorkomt dubbele toekenning.
CREATE TABLE "EarnedAchievement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "celebratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarnedAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EarnedAchievement_tenantId_userId_key_key" ON "EarnedAchievement"("tenantId", "userId", "key");
CREATE INDEX "EarnedAchievement_tenantId_userId_idx" ON "EarnedAchievement"("tenantId", "userId");
CREATE INDEX "EarnedAchievement_tenantId_category_idx" ON "EarnedAchievement"("tenantId", "category");
CREATE INDEX "EarnedAchievement_tenantId_earnedAt_idx" ON "EarnedAchievement"("tenantId", "earnedAt");
CREATE INDEX "EarnedAchievement_userId_celebratedAt_idx" ON "EarnedAchievement"("userId", "celebratedAt");

ALTER TABLE "EarnedAchievement" ADD CONSTRAINT "EarnedAchievement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EarnedAchievement" ADD CONSTRAINT "EarnedAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: zie prisma/sql/rls.sql (tenant_isolation policy) — apart toe te passen.
