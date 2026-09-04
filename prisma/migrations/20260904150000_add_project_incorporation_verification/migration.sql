-- AlterTable
ALTER TABLE "Project" ADD COLUMN "incorporationDocUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Project" ADD COLUMN "incorporationDocKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Project" ADD COLUMN "incorporationReason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Project" ADD COLUMN "incorporationVerificationStatus" "VerificationStatus";
ALTER TABLE "Project" ADD COLUMN "incorporationReviewedBy" TEXT;
ALTER TABLE "Project" ADD COLUMN "incorporationReviewNotes" TEXT;
ALTER TABLE "Project" ADD COLUMN "incorporationReviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Project_incorporationVerificationStatus_idx" ON "Project"("incorporationVerificationStatus");
