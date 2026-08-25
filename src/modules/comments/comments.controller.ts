import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private svc: CommentsService) {}

  @Get()
  list(@Query('postId') postId: string) { 
    return this.svc.list(postId); 
  }

  @Post()
  create(@Body() dto: { postId: string; content: string; parentId?: string }, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.create(userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
