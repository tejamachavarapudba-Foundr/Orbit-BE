// src/modules/events/events.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Import both from the same file destination
import { CreateEventDto, CancelEventDto } from './dto/create-event.dto'; 

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private svc: EventsService) {}

  @Get()
  list(@Request() req: any) {
    return this.svc.list(req.user.id);
  }

  // Declared before ':id' so "community" isn't swallowed as an :id value.
  @Get('community/:communityId')
  listForCommunity(@Param('communityId') communityId: string, @Request() req: any) {
    return this.svc.listForCommunity(communityId, req.user.id);
  }

  @Get(':id')
  get(@Param('id') id: string, @Request() req: any) {
    return this.svc.get(id, req.user.id);
  }

  @Post()
  create(@Body() dto: CreateEventDto, @Request() req: any) {
    const hostId = req.user.id;
    return this.svc.create(dto, hostId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateEventDto>, @Request() req: any) {
    const userId = req.user.id;
    return this.svc.update(id, dto, userId);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @Body() dto: CancelEventDto, @Request() req: any) {
    const userId = req.user.id;
    return this.svc.cancel(id, dto.Reason, userId);
  }

    @Post(':id/rsvp')
  rsvp(@Param('id') eventId: string, @Request() req: any) {
    const userId = req.user.id; // The logged-in user who clicked "Join"
    return this.svc.toggleRsvp(eventId, userId);
  }

    @Get(':id/attendees')
  getAttendees(@Param('id') eventId: string, @Request() req: any) {
    return this.svc.getAttendees(eventId, req.user.id);
  }
}
