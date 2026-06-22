import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  providers: [ProjectsService],
  imports: [NotificationsModule],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
