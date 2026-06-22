import { Module } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { ConnectionRequestsController } from './connection-requests.controller';
import { ConnectionRequestsService } from './connection-requests.service';

@Module({
  controllers: [ConnectionRequestsController],
  providers: [ConnectionRequestsService, PrismaService],
  exports: [ConnectionRequestsService],
})
export class ConnectionRequestsModule {}