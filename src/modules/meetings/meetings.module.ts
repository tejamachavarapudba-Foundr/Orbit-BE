import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { GoogleModule } from '../google/google.module';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { MeetingsReminderService } from './meetings-reminder.service';

@Module({
  imports: [NotificationsModule, GoogleModule],
  providers: [MeetingsService, MeetingsReminderService],
  controllers: [MeetingsController],
  exports: [MeetingsService],
})
export class MeetingsModule {}
