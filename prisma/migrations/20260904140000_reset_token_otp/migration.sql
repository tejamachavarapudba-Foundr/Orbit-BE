-- DropIndex
DROP INDEX IF EXISTS "User_resetToken_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "resetAttempts" INTEGER NOT NULL DEFAULT 0;
