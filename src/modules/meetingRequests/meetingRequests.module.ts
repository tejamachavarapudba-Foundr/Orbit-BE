import { Module } from '@nestjs/common';
import { MeetingRequestsController } from './meetingRequests.controller';
import { MeetingRequestsService } from './meetingRequests.service';
import { PrismaModule } from '../../prisma/prisma.module'; // Import your Prisma module globally or explicitly
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [MeetingRequestsController],
  providers: [MeetingRequestsService],
})
export class MeetingRequestsModule {}
