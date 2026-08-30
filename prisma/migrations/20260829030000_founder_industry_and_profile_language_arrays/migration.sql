-- AlterTable
ALTER TABLE "FounderProfile" DROP COLUMN "industry",
ADD COLUMN     "industry" TEXT[];

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "language",
ADD COLUMN     "language" TEXT[];
