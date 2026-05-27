import { Module } from '@nestjs/common';
import { StartupsService } from './startups.service';
import { StartupsController } from './startups.controller';

@Module({
  providers: [StartupsService],
  controllers: [StartupsController],
  exports: [StartupsService],
})
export class StartupsModule {}
