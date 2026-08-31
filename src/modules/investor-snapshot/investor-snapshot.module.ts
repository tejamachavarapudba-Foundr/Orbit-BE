import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { InvestorSnapshotController } from './investor-snapshot.controller';
import { InvestorSnapshotService } from './investor-snapshot.service';
import { PdfExtractionService } from './pdf-extraction.service';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 600000, limit: 5 }])],
  controllers: [InvestorSnapshotController],
  providers: [InvestorSnapshotService, PdfExtractionService],
  exports: [InvestorSnapshotService],
})
export class InvestorSnapshotModule {}