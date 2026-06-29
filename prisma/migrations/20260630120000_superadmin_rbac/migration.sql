-- Superadmin + RBAC + branding + invitations + audit log.
-- Rol-enum wordt HERNOEMD (waarden behouden) i.p.v. gedropt.

-- 1) Role-enum: hernoemen + SUPERADMIN toevoegen.
ALTER TYPE "Role" RENAME VALUE 'MEMBER' TO 'TENANT_MEMBER';
ALTER TYPE "Role" RENAME VALUE 'OWNER' TO 'TENANT_ADMIN';
ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';

-- 2) Nieuwe enum TenantStatus.
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- 3) User: nieuwe default-rol, nullable tenantId (voor SUPERADMIN), active-flag.
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'TENANT_MEMBER';
ALTER TABLE "User" ALTER COLUMN "tenantId" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- 4) Tenant: branding + status + soft-delete.
ALTER TABLE "Tenant" ADD COLUMN "secondaryColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "faviconUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "fontFamily" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Tenant" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- 5) Invitation.
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TENANT_MEMBER',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");
CREATE INDEX "Invitation_tenantId_idx" ON "Invitation"("tenantId");
CREATE INDEX "Invitation_token_idx" ON "Invitation"("token");
CREATE UNIQUE INDEX "Invitation_tenantId_email_key" ON "Invitation"("tenantId", "email");
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6) AuditLog (geen FK's: forensisch, overleeft verwijderingen).
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorRole" "Role",
    "tenantId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- 7) SUPERADMIN: e-mailadres globaal uniek (tenantId IS NULL) via partial index.
CREATE UNIQUE INDEX "User_email_superadmin_key" ON "User"("email") WHERE "tenantId" IS NULL;
