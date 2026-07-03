import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  providers: [PostsService],
  controllers: [PostsController],
  exports: [PostsService],
  imports: [PrismaModule, StorageModule ]
})
export class PostsModule {}
