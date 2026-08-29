-- AlterTable
ALTER TABLE "FounderProfile" ADD COLUMN     "portfolio" TEXT[];

-- AlterTable
ALTER TABLE "InvestorProfile" DROP COLUMN "portfolio",
ADD COLUMN     "portfolio" TEXT[],
ADD COLUMN     "investingAs" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "AdvisorProfile" ADD COLUMN     "expertiseOther" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "mentorshipExperience" TEXT NOT NULL DEFAULT '';
