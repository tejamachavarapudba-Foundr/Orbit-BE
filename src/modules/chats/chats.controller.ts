import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private svc: ChatsService) {}

  // GET /chats
     // GET /chats
  @Get() 
  list(@Req() req: any) { 
    // 1. Debug log to verify what Passport is attaching to your request
    console.log('--- ENFORCED AUTH PAYLOAD ---', req.user);

    // 2. Strict verification check
    if (!req.user) {
      throw new UnauthorizedException('Passport failed to extract user session');
    }

    const userId = req.user.id; // Passport strategy explicitly maps payload.sub to .id
    
    if (!userId) {
      throw new ForbiddenException('User ID is missing from validation token');
    }

    return this.svc.list(userId); 
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

  // DELETE /chats/:id
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.remove(id, userId);
  }
}
