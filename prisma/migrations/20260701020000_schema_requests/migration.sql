-- Schema-aanvragen: een sporter vraagt een (nieuw/aangepast) trainingsschema aan;
-- de coach beheert de aanvraag met statussen tot oplevering. Tenant-scoped + RLS
-- (policy in prisma/sql/rls.sql, toepassen met `npm run db:rls`).

CREATE TYPE "SchemaRequestGoal" AS ENUM ('MUSCLE', 'WEIGHT_LOSS', 'CONDITION', 'REHAB', 'STRENGTH', 'OTHER');
CREATE TYPE "SchemaRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'SCHEMA_CREATED', 'COMPLETED', 'REJECTED', 'CANCELLED');

CREATE TABLE "SchemaRequest" (
  "id"                   TEXT NOT NULL,
  "tenantId"             TEXT NOT NULL,
  "userId"               TEXT NOT NULL,
  "goal"                 "SchemaRequestGoal" NOT NULL,
  "description"          TEXT,
  "preferredStart"       TIMESTAMP(3),
  "notes"                TEXT,
  "status"               "SchemaRequestStatus" NOT NULL DEFAULT 'NEW',
  "handledById"          TEXT,
  "resolvedAssignmentId" TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchemaRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SchemaRequest_tenantId_status_idx" ON "SchemaRequest"("tenantId", "status");
CREATE INDEX "SchemaRequest_userId_idx" ON "SchemaRequest"("userId");

ALTER TABLE "SchemaRequest" ADD CONSTRAINT "SchemaRequest_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchemaRequest" ADD CONSTRAINT "SchemaRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
