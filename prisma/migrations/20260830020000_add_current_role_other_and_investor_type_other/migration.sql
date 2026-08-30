-- AlterTable
ALTER TABLE "FounderProfile" ADD COLUMN     "currentRoleOther" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "InvestorProfile" ADD COLUMN     "investorTypeOther" TEXT NOT NULL DEFAULT '';
