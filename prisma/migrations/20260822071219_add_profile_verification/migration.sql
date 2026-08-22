-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "AdvisorProfile" ADD COLUMN     "certifications" TEXT[];

-- AlterTable
ALTER TABLE "ProfessionalProfile" ADD COLUMN     "certifications" TEXT[];

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "identityVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "identityVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ServiceProviderProfile" ADD COLUMN     "companyLinkedinUrl" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "FounderVerification" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "certificateName" TEXT NOT NULL,
    "cinNumber" TEXT NOT NULL DEFAULT '',
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FounderVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FounderVerification_profileId_key" ON "FounderVerification"("profileId");

-- CreateIndex
CREATE INDEX "FounderVerification_status_idx" ON "FounderVerification"("status");

-- AddForeignKey
ALTER TABLE "FounderVerification" ADD CONSTRAINT "FounderVerification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

