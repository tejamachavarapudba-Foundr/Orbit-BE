-- AlterTable
ALTER TABLE "InvestorProfile" ADD COLUMN     "investorType" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "investmentStage" TEXT[],
ADD COLUMN     "yearsInvestingExperience" TEXT NOT NULL DEFAULT '';
