import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private svc: ChatsService) {}

  // GET /chats?archived=true
  @Get()
  list(@Query('archived') archived: string | undefined, @Req() req: any) {
    if (!req.user) {
      throw new UnauthorizedException('Passport failed to extract user session');
    }

    const userId = req.user.id; // Passport strategy explicitly maps payload.sub to .id

    if (!userId) {
      throw new ForbiddenException('User ID is missing from validation token');
    }

    return this.svc.list(userId, archived === 'true');
  }


  // GET /chats/:id
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.findOne(id, userId);
  }

  // POST /chats
  @Post()
  create(@Body() dto: { participantId: string }, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.create(userId, dto.participantId);
  }

  // PATCH /chats/:id/archive
  @Patch(':id/archive')
  setArchived(@Param('id') id: string, @Body() dto: { archived: boolean }, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.setArchived(id, userId, Boolean(dto.archived));
  }

  // DELETE /chats/:id
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.remove(id, userId);
  }
}
