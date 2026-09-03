import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

// RateLimitRecord rows are cheap but unbounded (one per distinct client+route
// combination) — sweep out anything whose window and any block have both
// lapsed so the table doesn't grow forever.
@Injectable()
export class RateLimitCleanupService {
  private readonly logger = new Logger(RateLimitCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanup() {
    const now = new Date();
    const { count } = await this.prisma.rateLimitRecord.deleteMany({
      where: {
        expiresAt: { lt: now },
        OR: [{ blockedUntil: null }, { blockedUntil: { lt: now } }],
      },
    });
    if (count > 0) {
      this.logger.log(`Cleaned up ${count} expired rate limit record(s)`);
    }
  }
}
