/*
  Warnings:

  - You are about to drop the column `previousExperience` on the `InvestorSnapshot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "InvestorSnapshot" DROP COLUMN "previousExperience",
ADD COLUMN     "availablePool" DOUBLE PRECISION,
ADD COLUMN     "expectedRunwayAfterRaise" DOUBLE PRECISION,
ADD COLUMN     "founderGithub" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "founderTwitter" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "hasFinancials" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasPitchDeck" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFounderVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isInvestorReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "keyAssumptions" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "keyPartnerships" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "majorAchievements" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "problemStatement" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "solutionSummary" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "startupVision" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "useOfFunds" TEXT[];
