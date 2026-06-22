import { Controller, Post, Get, Patch, Body, Param, Req, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { MeetingRequestsService } from './meetingRequests.service';
import { CreateMeetingRequestDto } from './dto/createmeetingRequests.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('meeting-requests')
export class MeetingRequestsController {
  constructor(private readonly meetingRequestsService: MeetingRequestsService) {}

  @Post()
  async create(@Req() req: any, @Body() createDto: CreateMeetingRequestDto) {
    // MODIFIED: Accepts both INVESTOR and USER roles safely
    const user = this.extractAndVerifyUser(req, ['INVESTOR', 'USER']);
    return this.meetingRequestsService.createRequest(user.id, createDto);
  }

  @Get('my')
  async findInvestorRequests(@Req() req: any) {
    // MODIFIED: Accepts both INVESTOR and USER roles safely
    const user = this.extractAndVerifyUser(req, ['INVESTOR', 'USER']);
    return this.meetingRequestsService.getInvestorRequests(user.id);
  }

  @Get('startup')
  async findStartupRequests(@Req() req: any) {
    // If your founder accounts also default to "USER", add 'USER' to this array too
    const user = this.extractAndVerifyUser(req, ['FOUNDER']);
    const startupId = user.startupId || user.id;
    return this.meetingRequestsService.getFounderRequests(startupId);
  }

  @Get('admin')
  async findAdminRequests(@Req() req: any) {
    this.extractAndVerifyUser(req, ['ADMIN']);
    return this.meetingRequestsService.getAdminRequests();
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    this.extractAndVerifyUser(req, ['ADMIN']);
    return this.meetingRequestsService.updateRequestStatus(id, updateStatusDto.status);
  }

  // Updated validator helper to process multiple matching roles smoothly
  private extractAndVerifyUser(req: any, allowedRoles: string[]) {
    let user = req.user;

    // Fallback extraction block if passport middleware is detached
    if (!user && req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const payloadBase64 = token.split('.')[1];
        user = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
      } catch (e) {
        throw new UnauthorizedException('Invalid or malformed token payload layout.');
      }
    }

    if (!user || !user.role) {
      throw new UnauthorizedException('Authentication details are missing a valid user role.');
    }

    const contextRole = String(user.role).toUpperCase().trim();
    const hasAccess = allowedRoles.some(role => role.toUpperCase().trim() === contextRole);

    if (!hasAccess) {
      throw new ForbiddenException(`Forbidden: Requires roles [${allowedRoles.join(', ')}]. Current role: [${contextRole}]`);
    }

    return user;
  }
}
