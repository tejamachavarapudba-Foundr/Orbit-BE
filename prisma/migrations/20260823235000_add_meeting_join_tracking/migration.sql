-- CreateTable
CREATE TABLE "MeetingJoin" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingJoin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingJoin_meetingId_idx" ON "MeetingJoin"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingJoin_meetingId_userId_key" ON "MeetingJoin"("meetingId", "userId");

-- AddForeignKey
ALTER TABLE "MeetingJoin" ADD CONSTRAINT "MeetingJoin_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingJoin" ADD CONSTRAINT "MeetingJoin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
