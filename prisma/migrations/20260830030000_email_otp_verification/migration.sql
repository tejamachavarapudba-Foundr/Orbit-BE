-- DropIndex
DROP INDEX "User_verificationToken_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "verificationAttempts" INTEGER NOT NULL DEFAULT 0;
