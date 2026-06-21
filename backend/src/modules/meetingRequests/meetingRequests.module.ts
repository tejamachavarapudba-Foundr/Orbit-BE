import { Module } from '@nestjs/common';
import { MeetingRequestsController } from './meetingRequests.controller';
import { MeetingRequestsService } from './meetingRequests.service';
import { PrismaModule } from '../../prisma/prisma.module'; // Import your Prisma module globally or explicitly

@Module({
  imports: [PrismaModule],
  controllers: [MeetingRequestsController],
  providers: [MeetingRequestsService],
})
export class MeetingRequestsModule {}
