// src/events/events.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventStatus } from '@prisma/client'; // 🆕 Import the new enum

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  // Public feed only — private community events live in the community's own
  // event list (listForCommunity) instead of showing up here too.
  async list(userId: string) {
    return this.prisma.event.findMany({
      where: {
        status: EventStatus.ACTIVE,
        isPrivate: false,
      },
      include: {
        _count: { select: { attendees: true } },
        host: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForCommunity(communityId: string, userId: string) {
    const membership = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this community.');
    }

    return this.prisma.event.findMany({
      where: {
        status: EventStatus.ACTIVE,
        communityId,
      },
      include: {
        _count: { select: { attendees: true } },
        host: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, userId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        _count: { select: { attendees: true } },
        host: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    if (!event) throw new NotFoundException(`Event with ID "${id}" not found`);
    if (userId) await this.assertVisible(event, userId);
    return event;
  }

  private async assertVisible(event: { id: string; isPrivate: boolean; hostId: string }, userId: string) {
    if (!event.isPrivate || event.hostId === userId) return;
    const invited = await this.prisma.eventInvite.findUnique({
      where: { eventId_userId: { eventId: event.id, userId } },
    });
    if (!invited) throw new ForbiddenException('This event is invite-only.');
  }

    async create(dto: CreateEventDto, hostId: string) {
    const event = await this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description || '',
        location: dto.location,
        startsAt: new Date(dto.startsAt),
        // If endsAt is supplied, build Date, otherwise leave undefined/null
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        hostId: hostId,
        isPrivate: dto.isPrivate ?? false,
        communityId: dto.communityId ?? null,
      },
      include: {
        _count: { select: { attendees: true } },
        host: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    if (event.isPrivate) {
      const inviteeIds = new Set(dto.inviteeIds ?? []);
      if (dto.communityId) {
        const members = await this.prisma.communityMember.findMany({
          where: { communityId: dto.communityId },
          select: { userId: true },
        });
        members.forEach((member) => inviteeIds.add(member.userId));
      }
      inviteeIds.delete(hostId);

      if (inviteeIds.size > 0) {
        await this.prisma.eventInvite.createMany({
          data: Array.from(inviteeIds).map((userId) => ({ eventId: event.id, userId })),
          skipDuplicates: true,
        });
      }
    }

    return event;
  }


  async update(id: string, dto: Partial<CreateEventDto>, userId: string) {
    const event = await this.get(id);
    
    // Strict Host verification guardrail
    if (event.hostId !== userId) {
      throw new ForbiddenException('Only the host can modify this event');
    }

    // Convert date properties safely if they exist in the incoming stream
    const updateData: any = { ...dto };
    if (dto.startsAt) updateData.startsAt = new Date(dto.startsAt);
    if (dto.endsAt) updateData.endsAt = new Date(dto.endsAt);

    return this.prisma.event.update({
      where: { id },
      data: updateData,
    });
  }

  // 🆕 Updated Cancel Method: Saves data securely instead of wiping it out
  async cancel(id: string, reason: string, userId: string) {
    const event = await this.get(id);
    
    if (event.hostId !== userId) {
      throw new ForbiddenException('Only the host can cancel this event');
    }

    // Soft-deletes the event and saves the cancellation context data
    return this.prisma.event.update({
      where: { id },
      data: {
        status: EventStatus.CANCELLED,
        cancellationReason: reason
      }
    });
  }

    async toggleRsvp(eventId: string, userId: string) {
    // 1. Ensure the event actually exists first, and this user can see it
    await this.get(eventId, userId);

    // 2. Check if this specific user has already RSVP'd
    const existingAttendee = await this.prisma.eventAttendee.findUnique({
      where: {
        eventId_userId: { eventId, userId },
      },
    });

    // 3. If they already RSVP'd, cancel/remove their attendance
    if (existingAttendee) {
      await this.prisma.eventAttendee.delete({
        where: {
          eventId_userId: { eventId, userId },
        },
      });
      return { status: 'cancelled', message: 'Successfully removed from event guestlist' };
    }

    // 4. If they haven't RSVP'd yet, add them to the guestlist
    const newAttendee = await this.prisma.eventAttendee.create({
      data: { eventId, userId },
      include: {
        user: {
          select: { fullName: true, avatarUrl: true } // Adjust fields based on your Profile model
        }
      }
    });

    return { status: 'confirmed', message: 'Successfully registered for event', data: newAttendee };
  }

    async getAttendees(eventId: string, userId: string) {
    // 1. Verify the event exists first, and this user can see it
    await this.get(eventId, userId);

    // 2. Fetch all attendees along with their profile data
    const rsvps = await this.prisma.eventAttendee.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            headline: true,
            company: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }, // Newest sign-ups first
    });

    // 3. Map the data to return a direct array of profiles for clean frontend rendering
    return rsvps.map((rsvp) => rsvp.user);
  }
}
