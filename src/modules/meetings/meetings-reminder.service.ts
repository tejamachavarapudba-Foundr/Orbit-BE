import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const CHECKPOINTS: { key: 't_minus_24h' | 't_minus_5h' | 't_minus_15m'; minutesBefore: number; label: string }[] = [
  { key: 't_minus_24h', minutesBefore: 24 * 60, label: 'is tomorrow' },
  { key: 't_minus_5h', minutesBefore: 5 * 60, label: 'starts in 5 hours' },
  { key: 't_minus_15m', minutesBefore: 15, label: 'starts in 15 minutes — join now' },
];

// A checkpoint fires once its window has been crossed; this tolerance keeps a
// 5-minute cron from missing a threshold that fell between two runs.
const WINDOW_MINUTES = 6;

@Injectable()
export class MeetingsReminderService {
  private readonly logger = new Logger(MeetingsReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run() {
    await this.sendDueReminders();
    await this.completePastMeetings();
  }

  private async sendDueReminders() {
    const now = Date.now();

    for (const checkpoint of CHECKPOINTS) {
      const windowStart = new Date(now + (checkpoint.minutesBefore - WINDOW_MINUTES) * 60_000);
      const windowEnd = new Date(now + checkpoint.minutesBefore * 60_000);

      const dueMeetings = await this.prisma.meeting.findMany({
        where: {
          status: 'upcoming',
          confirmedAt: { gte: windowStart, lte: windowEnd },
          reminders: { none: { checkpoint: checkpoint.key } },
        },
        include: { proposal: { include: { invitees: true } } },
      });

      await Promise.all(
        dueMeetings.map(async (meeting) => {
          const participantIds = [meeting.proposal.organizerId, ...meeting.proposal.invitees.map((i) => i.userId)];

          await this.notifications.createBulkNotification(
            participantIds,
            'MEETING_UPCOMING',
            'Meeting reminder',
            `Your meeting "${meeting.proposal.purpose}" ${checkpoint.label}.`,
          );

          await this.prisma.meetingReminderLog.create({
            data: { meetingId: meeting.id, checkpoint: checkpoint.key },
          });
        }),
      );
    }
  }

  private async completePastMeetings() {
    // A meeting can only have started by now if confirmedAt is already in the
    // past — cheap first filter, then confirm each one's own duration has
    // actually elapsed before flipping it, in plain JS (no raw SQL needed).
    const candidates = await this.prisma.meeting.findMany({
      where: { status: 'upcoming', confirmedAt: { lte: new Date() } },
      select: { id: true, confirmedAt: true, durationMins: true },
    });

    const now = Date.now();
    const finishedIds = candidates
      .filter((meeting) => meeting.confirmedAt.getTime() + meeting.durationMins * 60_000 < now)
      .map((meeting) => meeting.id);

    if (finishedIds.length === 0) return;

    await this.prisma.meeting.updateMany({
      where: { id: { in: finishedIds } },
      data: { status: 'completed' },
    });
    this.logger.log(`Marked ${finishedIds.length} meeting(s) completed`);
  }
}
