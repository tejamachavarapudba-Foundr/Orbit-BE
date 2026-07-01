import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';

import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import awsConfig from './config/aws.config';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SocketModule } from './socket/socket.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { PostsModule } from './modules/posts/posts.module';
import { CommentsModule } from './modules/comments/comments.module';
import { LikesModule } from './modules/likes/likes.module';
import { FollowsModule } from './modules/follows/follows.module';
import { ChatsModule } from './modules/chats/chats.module';
import { MessagesModule } from './modules/messages/messages.module';
import { StartupsModule } from './modules/startups/startups.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { EventsModule } from './modules/events/events.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MediaModule } from './modules/media/media.module';
import { SearchModule } from './modules/search/search.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { ConnectionRequestsModule } from './modules/connection-requests/connection-requests.module';
import { InvestorSnapshotModule } from './modules/investor-snapshot/investor-snapshot.module';
import { MeetingRequestsModule } from './modules/meetingRequests/meetingRequests.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      //load: [databaseConfig, jwtConfig, redisConfig, awsConfig],
        load: [databaseConfig,jwtConfig] // --- IGNORE ---
    }),
    // BullModule.forRoot({
    //   redis: {
    //     host: process.env.REDIS_HOST ?? 'localhost',
    //     port: Number(process.env.REDIS_PORT ?? 6379),
    //   },
    // }),
    PrismaModule,
    //RedisModule,
    SocketModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    PostsModule,
    CommentsModule,
    LikesModule,
    FollowsModule,
    ChatsModule,
    MessagesModule,
    StartupsModule,
    ProjectsModule,
    JobsModule,
    EventsModule,
    NotificationsModule,
    MediaModule,
    SearchModule,
    AdminModule,
    AnalyticsModule,
    PaymentsModule,
    OnboardingModule,
    InvestorSnapshotModule,
    ConnectionRequestsModule,
    MeetingRequestsModule,
    StorageModule,
  ],
})
export class AppModule {}
