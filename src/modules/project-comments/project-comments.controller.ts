import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ProjectCommentsService } from './project-comments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class ProjectCommentsController {
  constructor(private svc: ProjectCommentsService) {}

  @Get('projects/:id/comments')
  list(@Param('id') id: string) {
    return this.svc.list(id);
  }

  @Post('projects/:id/comments')
  create(@Param('id') id: string, @Body() dto: { content: string; parentId?: string }, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.create(userId, { projectId: id, content: dto.content, parentId: dto.parentId });
  }

  @Delete('project-comments/:id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.svc.remove(id, userId);
  }
}
