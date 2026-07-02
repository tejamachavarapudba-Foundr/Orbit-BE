import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
//import { Query } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private svc: MessagesService) {}

  // GET /messages?conversationId=<uuid>&limit=50&cursor=<msgId>
  @Get() 
  list(
    @Query('conversationId') conversationId: string,
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) { 
    // 1. Strict protection against undefined queries blowing up filters
    if (!conversationId) {
      throw new BadRequestException('Query parameter conversationId is required');
    }

    const userId = req.user.id; 
    return this.svc.list(conversationId, userId, limit ? parseInt(limit, 10) : 50, cursor); 
  }

  // POST /messages
  @Post()
  create(@Body() dto: { conversationId: string; content: string }, @Req() req: any) {
    const userId = req.user.id;
    return this.svc.create(userId, dto);
  }

  // PATCH /messages/:id/read
  @Patch(':id/read')
  updateStatus(@Param('id') id: string) {
    return this.svc.updateStatus(id);
  }

  // DELETE /messages/:id
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
  @Get(':conversationId/search')
  searchMessages(
    @Param('conversationId') conversationId: string,
    @Query('q') query: string,
    @Req() req: any,
  ) {
    return this.svc.searchMessages(
      conversationId,
      req.user.id,
      query,
    );
  }
}
