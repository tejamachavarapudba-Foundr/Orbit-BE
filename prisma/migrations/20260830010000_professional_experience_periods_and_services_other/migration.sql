-- AlterTable
ALTER TABLE "ProfessionalProfile" ADD COLUMN     "experiencePeriods" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ServiceProviderProfile" ADD COLUMN     "servicesOther" TEXT NOT NULL DEFAULT '';
