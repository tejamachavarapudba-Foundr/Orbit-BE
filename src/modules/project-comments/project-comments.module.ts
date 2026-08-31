import { Module } from '@nestjs/common';
import { ProjectCommentsService } from './project-comments.service';
import { ProjectCommentsController } from './project-comments.controller';

@Module({
  providers: [ProjectCommentsService],
  controllers: [ProjectCommentsController],
  exports: [ProjectCommentsService],
})
export class ProjectCommentsModule {}
