-- AlterTable
ALTER TABLE "User" ADD COLUMN "phoneNumber" TEXT,
ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
