import { Module } from '@nestjs/common';

import { InvestorSnapshotController } from './investor-snapshot.controller';
import { InvestorSnapshotService } from './investor-snapshot.service';

@Module({
  controllers: [InvestorSnapshotController],
  providers: [InvestorSnapshotService],
  exports: [InvestorSnapshotService],
})
export class InvestorSnapshotModule {}