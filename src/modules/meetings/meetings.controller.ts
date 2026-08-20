import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MeetingsService } from './meetings.service';
import { SaveAvailabilityDto } from './dto/save-availability.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { RespondProposalDto } from './dto/respond-proposal.dto';
import { CancelMeetingDto } from './dto/cancel-meeting.dto';

@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  // GET /meetings/availability/me
  @Get('availability/me')
  getMyAvailability(@Req() req: any) {
    const profileId = req.user.id || req.user.sub;
    return this.meetings.getAvailability(profileId);
  }

  // PUT /meetings/availability
  @Put('availability')
  saveAvailability(@Body() dto: SaveAvailabilityDto, @Req() req: any) {
    const profileId = req.user.id || req.user.sub;
    return this.meetings.saveAvailability(profileId, dto);
  }

  // GET /meetings/availability/:profileId/open-slots
  @Get('availability/:profileId/open-slots')
  getOpenSlots(@Param('profileId') profileId: string) {
    return this.meetings.getOpenSlotsFor(profileId);
  }

  // POST /meetings/proposals
  @Post('proposals')
  createProposal(@Body() dto: CreateProposalDto, @Req() req: any) {
    const organizerId = req.user.id || req.user.sub;
    return this.meetings.createProposal(organizerId, dto);
  }

  // GET /meetings/proposals/:id
  @Get('proposals/:id')
  getProposal(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.meetings.getProposalForResponse(id, userId);
  }

  // POST /meetings/proposals/:id/respond
  @Post('proposals/:id/respond')
  respond(@Param('id') id: string, @Body() dto: RespondProposalDto, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.meetings.respondToProposal(id, userId, dto);
  }

  // DELETE /meetings/proposals/:id
  @Delete('proposals/:id')
  withdraw(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.meetings.withdrawProposal(id, userId);
  }

  // POST /meetings/:id/cancel
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelMeetingDto, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.meetings.cancelMeeting(id, userId, dto);
  }

  // GET /meetings/mine?tab=upcoming|completed|cancelled
  @Get('mine')
  listMine(@Query('tab') tab: 'upcoming' | 'completed' | 'cancelled' = 'upcoming', @Req() req: any) {
    const profileId = req.user.id || req.user.sub;
    return this.meetings.listMine(profileId, tab);
  }
}
