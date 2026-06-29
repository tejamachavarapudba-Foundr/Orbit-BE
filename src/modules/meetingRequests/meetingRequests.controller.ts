import { Controller, Post, Get, Patch, Body, Param, Req, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { MeetingRequestsService } from './meetingRequests.service';
import { CreateMeetingRequestDto } from './dto/createmeetingRequests.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('meeting-requests')
export class MeetingRequestsController {
  constructor(private readonly meetingRequestsService: MeetingRequestsService) {}

    @Post()
  async create(@Req() req: any, @Body() createDto: CreateMeetingRequestDto) {
    const user = this.extractAndVerifyUser(req, ['INVESTOR', 'USER']);
    
    // Fallback chain to catch the correct ID property from your JWT configuration
    const investorId = user.id || user.sub || user.userId; 
    
    return this.meetingRequestsService.createRequest(investorId, createDto);
  }

  @Get('my')
  async findInvestorRequests(@Req() req: any) {
    const user = this.extractAndVerifyUser(req, ['INVESTOR', 'USER']);
    
    // Fallback chain to catch the correct ID property from your JWT configuration
    const investorId = user.id || user.sub || user.userId;
    
    return this.meetingRequestsService.getInvestorRequests(investorId);
  }


  @Get('startup/:id')
  async findStartupRequests(
    @Param('id') startupId: string,
    @Req() req: any
  ) {
    this.extractAndVerifyUser(req, ['FOUNDER']);
    return this.meetingRequestsService.getFounderRequests(startupId);
  }

  @Get('admin')
  async findAdminRequests(@Req() req: any) {
    console.log("ADMIN USER:", req.user);
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

  private extractAndVerifyUser(req: any, allowedRoles: string[]) {
    let user = req.user;

    if (!user && req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const payloadBase64 = token.split('.')[1];
        // Ensure accurate UTF-8 parsing from Base64 buffers
        user = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
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
