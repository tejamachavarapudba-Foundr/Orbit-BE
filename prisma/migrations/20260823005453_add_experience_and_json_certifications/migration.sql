-- AlterTable
ALTER TABLE "AdvisorProfile" ADD COLUMN     "experiences" JSONB NOT NULL DEFAULT '[]',
DROP COLUMN "certifications",
ADD COLUMN     "certifications" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ProfessionalProfile" ADD COLUMN     "experiences" JSONB NOT NULL DEFAULT '[]',
DROP COLUMN "certifications",
ADD COLUMN     "certifications" JSONB NOT NULL DEFAULT '[]';

