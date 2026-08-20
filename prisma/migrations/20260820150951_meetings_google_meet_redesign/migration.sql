-- CreateEnum
CREATE TYPE "InviteMode" AS ENUM ('startup', 'people');

-- CreateEnum
CREATE TYPE "SchedulingMode" AS ENUM ('availability_pick', 'date_push');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('pending', 'confirmed', 'declined', 'cancelled');

-- CreateEnum
CREATE TYPE "InviteeResponse" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('upcoming', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ReminderCheckpoint" AS ENUM ('t_minus_24h', 't_minus_5h', 't_minus_15m');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MEETING_RESPONSE';
ALTER TYPE "NotificationType" ADD VALUE 'MEETING_CANCELLED';

-- DropForeignKey
ALTER TABLE "MeetingRequest" DROP CONSTRAINT "MeetingRequest_investorId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingRequest" DROP CONSTRAINT "MeetingRequest_startupId_fkey";

-- DropTable
DROP TABLE "MeetingRequest";

-- CreateTable
CREATE TABLE "ConnectedGoogleAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConnectedGoogleAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingProposal" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "inviteMode" "InviteMode" NOT NULL,
    "targetStartupId" TEXT,
    "purpose" TEXT NOT NULL,
    "message" TEXT,
    "schedulingMode" "SchedulingMode" NOT NULL,
    "proposedSlots" JSONB,
    "timezone" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalInvitee" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" "InviteeResponse" NOT NULL DEFAULT 'pending',
    "selectedSlot" JSONB,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ProposalInvitee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 30,
    "meetLink" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'upcoming',
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingReminderLog" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "checkpoint" "ReminderCheckpoint" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedGoogleAccount_userId_key" ON "ConnectedGoogleAccount"("userId");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_profileId_idx" ON "AvailabilitySlot"("profileId");

-- CreateIndex
CREATE INDEX "MeetingProposal_organizerId_idx" ON "MeetingProposal"("organizerId");

-- CreateIndex
CREATE INDEX "MeetingProposal_status_idx" ON "MeetingProposal"("status");

-- CreateIndex
CREATE INDEX "ProposalInvitee_userId_idx" ON "ProposalInvitee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalInvitee_proposalId_userId_key" ON "ProposalInvitee"("proposalId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_proposalId_key" ON "Meeting"("proposalId");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "Meeting_confirmedAt_idx" ON "Meeting"("confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingReminderLog_meetingId_checkpoint_key" ON "MeetingReminderLog"("meetingId", "checkpoint");

-- AddForeignKey
ALTER TABLE "ConnectedGoogleAccount" ADD CONSTRAINT "ConnectedGoogleAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingProposal" ADD CONSTRAINT "MeetingProposal_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingProposal" ADD CONSTRAINT "MeetingProposal_targetStartupId_fkey" FOREIGN KEY ("targetStartupId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalInvitee" ADD CONSTRAINT "ProposalInvitee_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "MeetingProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalInvitee" ADD CONSTRAINT "ProposalInvitee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "MeetingProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingReminderLog" ADD CONSTRAINT "MeetingReminderLog_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

