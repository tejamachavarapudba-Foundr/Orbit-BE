import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GoogleCalendarService } from '../google/google-calendar.service';
import { SaveAvailabilityDto } from './dto/save-availability.dto';
import { CreateProposalDto, ProposedSlotInput } from './dto/create-proposal.dto';
import { RespondProposalDto } from './dto/respond-proposal.dto';
import { CancelMeetingDto } from './dto/cancel-meeting.dto';

const DEFAULT_DURATION_MINS = 30;
const OPEN_SLOT_WINDOW_DAYS = 14;

const proposalPeopleInclude = {
  organizer: { select: { id: true, fullName: true, avatarUrl: true } },
  invitees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
} as const;

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly googleCalendar: GoogleCalendarService,
  ) {}

  // ---------- Availability ----------

  async saveAvailability(profileId: string, dto: SaveAvailabilityDto) {
    await this.prisma.$transaction([
      this.prisma.availabilitySlot.deleteMany({ where: { profileId } }),
      this.prisma.availabilitySlot.createMany({
        data: dto.slots.map((slot) => ({
          profileId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          timezone: dto.timezone,
          isActive: true,
        })),
      }),
    ]);
    return this.getAvailability(profileId);
  }

  async getAvailability(profileId: string) {
    return this.prisma.availabilitySlot.findMany({
      where: { profileId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  /**
   * Expands a profile's recurring weekly availability into concrete bookable
   * {date, time} options over the next 14 days.
   *
   * Excludes any candidate slot that overlaps a meeting this profile already
   * has confirmed — meetings run 30min-1hr (or whatever durationMins ends up
   * being), so this is a real interval overlap check, not just a same-start
   * comparison.
   */
  async getOpenSlotsFor(profileId: string) {
    const slots = await this.getAvailability(profileId);
    if (slots.length === 0) return { timezone: null, slots: [] as { date: string; time: string }[] };

    const windowEnd = new Date(Date.now() + OPEN_SLOT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const busyMeetings = await this.prisma.meeting.findMany({
      where: {
        status: 'upcoming',
        confirmedAt: { gte: new Date(), lte: windowEnd },
        proposal: { OR: [{ organizerId: profileId }, { invitees: { some: { userId: profileId } } }] },
      },
      select: { confirmedAt: true, durationMins: true },
    });

    const targetTimezone = slots[0].timezone;
    const busyRanges = busyMeetings.map((meeting) => {
      const { dateStr, minutes } = this.wallClockInZone(meeting.confirmedAt, targetTimezone);
      return {
        date: dateStr,
        startMinutes: minutes,
        endMinutes: minutes + meeting.durationMins,
      };
    });

    const overlapsExistingMeeting = (dateStr: string, candidateStart: number) => {
      const candidateEnd = candidateStart + DEFAULT_DURATION_MINS;
      return busyRanges.some(
        (range) => range.date === dateStr && candidateStart < range.endMinutes && candidateEnd > range.startMinutes,
      );
    };

    const results: { date: string; time: string }[] = [];
    const today = new Date();

    for (let i = 0; i < OPEN_SLOT_WINDOW_DAYS; i += 1) {
      const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i));
      const dayOfWeek = day.getUTCDay();
      const dateStr = day.toISOString().slice(0, 10);

      for (const slot of slots.filter((item) => item.dayOfWeek === dayOfWeek)) {
        const [startH, startM] = slot.startTime.split(':').map(Number);
        const [endH, endM] = slot.endTime.split(':').map(Number);
        let cursor = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        while (cursor + DEFAULT_DURATION_MINS <= endMinutes) {
          if ((i > 0 || this.isLaterToday(cursor)) && !overlapsExistingMeeting(dateStr, cursor)) {
            const hh = String(Math.floor(cursor / 60)).padStart(2, '0');
            const mm = String(cursor % 60).padStart(2, '0');
            results.push({ date: dateStr, time: `${hh}:${mm}` });
          }
          cursor += DEFAULT_DURATION_MINS;
        }
      }
    }

    return { timezone: slots[0].timezone, slots: results };
  }

  private isLaterToday(minutesOfDay: number) {
    const now = new Date();
    return minutesOfDay > now.getUTCHours() * 60 + now.getUTCMinutes();
  }

  // ---------- Create proposal ----------

  async createProposal(organizerId: string, dto: CreateProposalDto) {
    const inviteeIds = await this.resolveInvitees(dto);

    if (inviteeIds.includes(organizerId)) {
      throw new BadRequestException('You cannot invite yourself to a meeting');
    }

    if (dto.schedulingMode === 'availability_pick') {
      if (inviteeIds.length !== 1) {
        throw new BadRequestException('Pick their availability only works for a single invitee');
      }
      if (!dto.selectedSlot) {
        throw new BadRequestException('selectedSlot is required for availability_pick');
      }
      return this.bookAgainstAvailability(organizerId, inviteeIds[0], dto);
    }

    if (!dto.proposedSlots || dto.proposedSlots.length === 0) {
      throw new BadRequestException('proposedSlots is required for date_push');
    }

    const proposal = await this.prisma.meetingProposal.create({
      data: {
        organizerId,
        inviteMode: dto.inviteMode,
        targetStartupId: dto.inviteMode === 'startup' ? dto.targetStartupId : null,
        purpose: dto.purpose,
        message: dto.message,
        schedulingMode: dto.schedulingMode,
        proposedSlots: dto.proposedSlots as unknown as object,
        timezone: dto.timezone ?? 'UTC',
        invitees: { create: inviteeIds.map((userId) => ({ userId })) },
      },
      include: { invitees: true },
    });

    for (const inviteeId of inviteeIds) {
      await this.notifications.createNotification(
        inviteeId,
        'MEETING_REQUEST',
        'New meeting request',
        `${dto.purpose} — pick a time that works for you.`,
      );
    }

    return proposal;
  }

  private async resolveInvitees(dto: CreateProposalDto): Promise<string[]> {
    if (dto.inviteMode === 'startup') {
      if (!dto.targetStartupId) {
        throw new BadRequestException('targetStartupId is required when inviteMode is startup');
      }
      const project = await this.prisma.project.findUnique({ where: { id: dto.targetStartupId } });
      if (!project) throw new NotFoundException('Startup not found');
      return [project.ownerId];
    }

    if (!dto.inviteeUserIds || dto.inviteeUserIds.length === 0) {
      throw new BadRequestException('inviteeUserIds is required when inviteMode is people');
    }
    return dto.inviteeUserIds;
  }

  private async bookAgainstAvailability(organizerId: string, inviteeId: string, dto: CreateProposalDto) {
    const { slots, timezone: inviteeTimezone } = await this.getOpenSlotsFor(inviteeId);
    const match = slots.find((s) => s.date === dto.selectedSlot!.date && s.time === dto.selectedSlot!.time);
    if (!match) {
      throw new BadRequestException('That slot is no longer open — refresh their availability');
    }

    const proposal = await this.prisma.meetingProposal.create({
      data: {
        organizerId,
        inviteMode: dto.inviteMode,
        targetStartupId: dto.inviteMode === 'startup' ? dto.targetStartupId : null,
        purpose: dto.purpose,
        message: dto.message,
        schedulingMode: dto.schedulingMode,
        status: 'confirmed',
        invitees: {
          create: [{ userId: inviteeId, response: 'accepted', selectedSlot: dto.selectedSlot as unknown as object, respondedAt: new Date() }],
        },
      },
    });

    const timezone = inviteeTimezone ?? dto.timezone ?? 'UTC';
    const meeting = await this.confirmMeeting(proposal.id, organizerId, [inviteeId], dto.selectedSlot!, timezone, dto.purpose, dto.message);

    await this.notifications.createNotification(
      inviteeId,
      'MEETING_UPCOMING',
      'New meeting booked',
      `${dto.purpose} — booked for ${dto.selectedSlot!.date} at ${dto.selectedSlot!.time}.`,
    );

    return { proposal, meeting };
  }

  // ---------- Respond (date_push mode) ----------

  async respondToProposal(proposalId: string, userId: string, dto: RespondProposalDto) {
    const proposal = await this.prisma.meetingProposal.findUnique({
      where: { id: proposalId },
      include: { invitees: true },
    });
    if (!proposal) throw new NotFoundException('Meeting proposal not found');

    const invitee = proposal.invitees.find((item) => item.userId === userId);
    if (!invitee) throw new ForbiddenException('You were not invited to this meeting');
    if (proposal.status !== 'pending') {
      throw new BadRequestException('This proposal has already been resolved');
    }

    if (dto.action === 'accept') {
      const proposedSlots = (proposal.proposedSlots as unknown as ProposedSlotInput[]) ?? [];
      const chosen = proposedSlots.find((s) => s.date === dto.selectedSlot?.date && s.time === dto.selectedSlot?.time);
      if (!chosen) throw new BadRequestException('selectedSlot must be one of the proposed dates');

      // Confirm on Google Calendar first — it's the step most likely to fail
      // (e.g. the organizer never connected Google Meet). Only record the
      // invitee's acceptance once the meeting actually exists, so a failure
      // here leaves the proposal untouched and safely retryable instead of
      // stranding it "accepted" with no meeting behind it.
      const meeting = await this.confirmMeeting(
        proposal.id,
        proposal.organizerId,
        [userId],
        chosen,
        proposal.timezone ?? 'UTC',
        proposal.purpose,
        proposal.message ?? undefined,
      );

      await this.prisma.proposalInvitee.update({
        where: { id: invitee.id },
        data: { response: 'accepted', selectedSlot: chosen as unknown as object, respondedAt: new Date() },
      });

      await this.notifications.createNotification(
        proposal.organizerId,
        'MEETING_RESPONSE',
        'Meeting confirmed',
        `Your meeting request for "${proposal.purpose}" was accepted.`,
      );

      return { proposal, meeting };
    }

    // reject
    await this.prisma.proposalInvitee.update({
      where: { id: invitee.id },
      data: { response: 'rejected', respondedAt: new Date() },
    });

    const refreshed = await this.prisma.proposalInvitee.findMany({ where: { proposalId } });
    const allRejected = refreshed.every((item) => item.response === 'rejected');

    if (allRejected) {
      await this.prisma.meetingProposal.update({ where: { id: proposalId }, data: { status: 'declined' } });
      await this.notifications.createNotification(
        proposal.organizerId,
        'MEETING_RESPONSE',
        'Meeting request declined',
        dto.replyMessage
          ? `"${proposal.purpose}" was declined: ${dto.replyMessage}`
          : `"${proposal.purpose}" was declined.`,
      );
    }

    return { declined: true, allRejected };
  }

  private async confirmMeeting(
    proposalId: string,
    organizerId: string,
    inviteeIds: string[],
    slot: ProposedSlotInput,
    timezone: string,
    purpose: string,
    message?: string,
  ) {
    const [organizer, invitees] = await Promise.all([
      this.prisma.profile.findUnique({ where: { id: organizerId }, include: { user: true } }),
      this.prisma.profile.findMany({ where: { id: { in: inviteeIds } }, include: { user: true } }),
    ]);
    if (!organizer) throw new NotFoundException('Organizer profile not found');

    const startISO = `${slot.date}T${slot.time}:00`;
    const endISO = this.addMinutesToLocalIso(startISO, DEFAULT_DURATION_MINS);

    const { meetLink, googleEventId } = await this.googleCalendar.createEventWithMeet({
      organizerId,
      attendeeEmails: [organizer.user.email, ...invitees.map((i) => i.user.email)],
      summary: purpose,
      description: message ?? '',
      startISO,
      endISO,
      timezone,
      requestId: proposalId,
    });

    const meeting = await this.prisma.meeting.create({
      data: {
        proposalId,
        confirmedAt: this.zonedTimeToUtc(startISO, timezone),
        timezone,
        durationMins: DEFAULT_DURATION_MINS,
        meetLink,
        googleEventId,
        status: 'upcoming',
      },
    });

    await this.prisma.meetingProposal.update({ where: { id: proposalId }, data: { status: 'confirmed' } });

    return meeting;
  }

  /**
   * `startISO` is a naive "wall clock" string (no offset) meaning the time
   * as experienced in `timeZone` — e.g. "2026-08-24T04:20:00" + "Asia/Kolkata"
   * means 4:20am IST. `new Date(startISO)` would parse those digits as the
   * server's own runtime zone (UTC on Railway), silently shifting the real
   * instant by the zone's offset. This converts it to the true UTC instant
   * instead, using the standard guess-then-correct trick since Node has no
   * built-in "parse wall clock time in an arbitrary IANA zone" API.
   */
  private zonedTimeToUtc(naiveIso: string, timeZone: string): Date {
    const guessUtc = new Date(`${naiveIso}Z`);
    const partsInZone = this.formatPartsInZone(guessUtc, timeZone);
    const asIfLocal = Date.UTC(
      Number(partsInZone.year),
      Number(partsInZone.month) - 1,
      Number(partsInZone.day),
      Number(partsInZone.hour),
      Number(partsInZone.minute),
      Number(partsInZone.second),
    );
    const offsetMs = guessUtc.getTime() - asIfLocal;
    return new Date(guessUtc.getTime() + offsetMs);
  }

  /** The inverse read: given a true UTC instant, what's the wall-clock date
   * and minutes-of-day in `timeZone`. */
  private wallClockInZone(date: Date, timeZone: string): { dateStr: string; minutes: number } {
    const parts = this.formatPartsInZone(date, timeZone);
    return {
      dateStr: `${parts.year}-${parts.month}-${parts.day}`,
      minutes: Number(parts.hour) * 60 + Number(parts.minute),
    };
  }

  private formatPartsInZone(date: Date, timeZone: string): Record<string, string> {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    return dtf.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
  }

  private addMinutesToLocalIso(localIso: string, minutes: number) {
    const [datePart, timePart] = localIso.split('T');
    const [h, m] = timePart.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${datePart}T${hh}:${mm}:00`;
  }

  // ---------- Withdraw / cancel ----------

  async withdrawProposal(proposalId: string, userId: string) {
    const proposal = await this.prisma.meetingProposal.findUnique({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException('Meeting proposal not found');
    if (proposal.organizerId !== userId) throw new ForbiddenException('Only the organizer can withdraw this request');
    if (proposal.status !== 'pending') throw new BadRequestException('Only a pending request can be withdrawn');

    return this.prisma.meetingProposal.update({ where: { id: proposalId }, data: { status: 'cancelled' } });
  }

  async cancelMeeting(meetingId: string, userId: string, dto: CancelMeetingDto) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { proposal: { include: { invitees: true } } },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const isOrganizer = meeting.proposal.organizerId === userId;
    const isInvitee = meeting.proposal.invitees.some((item) => item.userId === userId);
    if (!isOrganizer && !isInvitee) throw new ForbiddenException('You are not part of this meeting');
    if (meeting.status !== 'upcoming') throw new BadRequestException('This meeting is not upcoming');

    await this.googleCalendar.deleteEvent(meeting.proposal.organizerId, meeting.googleEventId);

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'cancelled', cancelledBy: userId, cancelReason: dto.reason, cancelledAt: new Date() },
    });

    const otherParties = [meeting.proposal.organizerId, ...meeting.proposal.invitees.map((i) => i.userId)].filter(
      (id) => id !== userId,
    );
    for (const partyId of otherParties) {
      await this.notifications.createNotification(
        partyId,
        'MEETING_CANCELLED',
        'Meeting cancelled',
        dto.reason ? `"${meeting.proposal.purpose}" was cancelled: ${dto.reason}` : `"${meeting.proposal.purpose}" was cancelled.`,
      );
    }

    return updated;
  }

  // ---------- My Meetings ----------

  async listMine(profileId: string, tab: 'upcoming' | 'completed' | 'cancelled') {
    if (tab === 'completed') {
      return this.prisma.meeting.findMany({
        where: { status: 'completed', proposal: { OR: [{ organizerId: profileId }, { invitees: { some: { userId: profileId } } }] } },
        include: { proposal: { include: proposalPeopleInclude } },
        orderBy: { confirmedAt: 'desc' },
      });
    }

    if (tab === 'cancelled') {
      const [meetings, proposals] = await Promise.all([
        this.prisma.meeting.findMany({
          where: { status: 'cancelled', proposal: { OR: [{ organizerId: profileId }, { invitees: { some: { userId: profileId } } }] } },
          include: { proposal: { include: proposalPeopleInclude } },
        }),
        this.prisma.meetingProposal.findMany({
          where: { status: { in: ['declined', 'cancelled'] }, OR: [{ organizerId: profileId }, { invitees: { some: { userId: profileId } } }] },
          include: proposalPeopleInclude,
        }),
      ]);
      return { meetings, proposals };
    }

    // upcoming = confirmed-and-not-yet-happened meetings + still-pending proposals
    const [meetings, pendingProposals] = await Promise.all([
      this.prisma.meeting.findMany({
        where: { status: 'upcoming', proposal: { OR: [{ organizerId: profileId }, { invitees: { some: { userId: profileId } } }] } },
        include: { proposal: { include: proposalPeopleInclude } },
        orderBy: { confirmedAt: 'asc' },
      }),
      this.prisma.meetingProposal.findMany({
        where: { status: 'pending', OR: [{ organizerId: profileId }, { invitees: { some: { userId: profileId } } }] },
        include: proposalPeopleInclude,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { meetings, pendingProposals };
  }

  async getProposalForResponse(proposalId: string, userId: string) {
    const proposal = await this.prisma.meetingProposal.findUnique({
      where: { id: proposalId },
      include: proposalPeopleInclude,
    });
    if (!proposal) throw new NotFoundException('Meeting proposal not found');
    const isInvitee = proposal.invitees.some((item) => item.userId === userId);
    if (proposal.organizerId !== userId && !isInvitee) {
      throw new ForbiddenException('You are not part of this meeting request');
    }
    return proposal;
  }
}
