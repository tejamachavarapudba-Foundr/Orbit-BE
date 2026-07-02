import { Module } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
  ],
 providers: [ProfilesService], controllers: [ProfilesController], exports: [ProfilesService] })
export class ProfilesModule {}
