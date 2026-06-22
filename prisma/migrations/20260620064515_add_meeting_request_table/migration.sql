-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'founder_contacted', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "MeetingRequest" (
    "id" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "preferredDate1" TIMESTAMP(3) NOT NULL,
    "preferredTime1" TEXT NOT NULL,
    "preferredDate2" TIMESTAMP(3),
    "preferredTime2" TEXT,
    "expectedInvestment" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MeetingRequest" ADD CONSTRAINT "MeetingRequest_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRequest" ADD CONSTRAINT "MeetingRequest_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
