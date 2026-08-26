-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "archivedByUserA" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archivedByUserB" BOOLEAN NOT NULL DEFAULT false;
