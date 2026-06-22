// src/events/events.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventStatus } from '@prisma/client'; // 🆕 Import the new enum

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

   // 🆕 Update your list method to only show active events on the public feed
    async list() {
    return this.prisma.event.findMany({
      where: { status: EventStatus.ACTIVE }, 
      include: {
        _count: { select: { attendees: true } }
      }, // <-- Check to make sure this brace is closed properly
      orderBy: { startsAt: 'asc' },
    });
  }

  async get(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException(`Event with ID "${id}" not found`);
    return event;
  }

    async create(dto: CreateEventDto, hostId: string) {
    return this.prisma.event.create({
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
      },
    });
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
    // 1. Ensure the event actually exists first
    await this.get(eventId);

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

    async getAttendees(eventId: string) {
    // 1. Verify the event exists first
    await this.get(eventId);

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
