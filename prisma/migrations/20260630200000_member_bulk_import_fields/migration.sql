-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MAN', 'VROUW', 'NON_BINAIR', 'ONBEKEND');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "memberNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_memberNumber_key" ON "User"("tenantId", "memberNumber");
