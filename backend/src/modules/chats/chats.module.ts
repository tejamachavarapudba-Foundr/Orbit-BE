import { Module } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  providers: [ChatsService],
  imports: [NotificationsModule],
  controllers: [ChatsController],
  exports: [ChatsService],
})
export class ChatsModule {}
