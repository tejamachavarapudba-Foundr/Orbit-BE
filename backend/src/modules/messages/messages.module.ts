import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  providers: [MessagesService],
  imports: [NotificationsModule],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
