-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CONNECTION_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'CONNECTION_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'FOLLOW';
ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_INTEREST';
ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_REVIEW';
ALTER TYPE "NotificationType" ADD VALUE 'INVESTOR_INTEREST';
ALTER TYPE "NotificationType" ADD VALUE 'MEETING_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'SYSTEM_ALERT';
