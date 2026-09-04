-- AlterTable
ALTER TABLE "ProfessionalProfile" ADD COLUMN "verificationStatus" "VerificationStatus";
ALTER TABLE "ProfessionalProfile" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "ProfessionalProfile" ADD COLUMN "reviewNotes" TEXT;
ALTER TABLE "ProfessionalProfile" ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ProfessionalProfile_verificationStatus_idx" ON "ProfessionalProfile"("verificationStatus");
