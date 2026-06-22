/*
  Warnings:

  - A unique constraint covering the columns `[resetToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ConnectionRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MemberRole" ADD VALUE 'advisor';
ALTER TYPE "MemberRole" ADD VALUE 'professional';
ALTER TYPE "MemberRole" ADD VALUE 'service_provider';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpires" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ConnectionRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "targetCustomers" TEXT NOT NULL DEFAULT '',
    "businessModel" TEXT NOT NULL DEFAULT '',
    "revenueStreams" TEXT NOT NULL DEFAULT '',
    "marketOpportunity" TEXT NOT NULL DEFAULT '',
    "totalUsers" INTEGER,
    "activeUsers" INTEGER,
    "payingCustomers" INTEGER,
    "enterpriseCustomers" INTEGER,
    "customerGrowthRate" DOUBLE PRECISION,
    "revenueGrowthRate" DOUBLE PRECISION,
    "mrr" DOUBLE PRECISION,
    "arr" DOUBLE PRECISION,
    "cashBalance" DOUBLE PRECISION,
    "burnRate" DOUBLE PRECISION,
    "runwayMonths" DOUBLE PRECISION,
    "grossMargin" DOUBLE PRECISION,
    "cac" DOUBLE PRECISION,
    "ltv" DOUBLE PRECISION,
    "ltvCacRatio" DOUBLE PRECISION,
    "churnRate" DOUBLE PRECISION,
    "ebitda" DOUBLE PRECISION,
    "ebitdaPercent" DOUBLE PRECISION,
    "currentRound" TEXT NOT NULL DEFAULT '',
    "amountRaising" DOUBLE PRECISION,
    "equityOffered" DOUBLE PRECISION,
    "minimumCheckSize" DOUBLE PRECISION,
    "maximumCheckSize" DOUBLE PRECISION,
    "founderOwnership" DOUBLE PRECISION,
    "employeeEsop" DOUBLE PRECISION,
    "investorOwnership" DOUBLE PRECISION,
    "year1Revenue" DOUBLE PRECISION,
    "year2Revenue" DOUBLE PRECISION,
    "year3Revenue" DOUBLE PRECISION,
    "projectedCustomers" INTEGER,
    "projectedTeamSize" INTEGER,
    "breakEvenDate" TIMESTAMP(3),
    "topRisks" TEXT NOT NULL DEFAULT '',
    "competition" TEXT NOT NULL DEFAULT '',
    "operationalChallenges" TEXT NOT NULL DEFAULT '',
    "regulatoryRisks" TEXT NOT NULL DEFAULT '',
    "mitigationPlan" TEXT NOT NULL DEFAULT '',
    "founderLinkedin" TEXT NOT NULL DEFAULT '',
    "previousExperience" TEXT NOT NULL DEFAULT '',
    "pitchDeckUrl" TEXT NOT NULL DEFAULT '',
    "financialProjectionUrl" TEXT NOT NULL DEFAULT '',
    "dataRoomUrl" TEXT NOT NULL DEFAULT '',
    "registrationDocUrl" TEXT NOT NULL DEFAULT '',
    "gstDocUrl" TEXT NOT NULL DEFAULT '',
    "govtIdDocUrl" TEXT NOT NULL DEFAULT '',
    "completionPercentage" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectionRequest_requesterId_idx" ON "ConnectionRequest"("requesterId");

-- CreateIndex
CREATE INDEX "ConnectionRequest_recipientId_idx" ON "ConnectionRequest"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionRequest_requesterId_recipientId_key" ON "ConnectionRequest"("requesterId", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorSnapshot_projectId_key" ON "InvestorSnapshot"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorSnapshot" ADD CONSTRAINT "InvestorSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
