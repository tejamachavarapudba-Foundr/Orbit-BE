import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  providers: [ProjectsService],
  imports: [NotificationsModule, StorageModule, PrismaModule],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})

export class ProjectsModule {}
