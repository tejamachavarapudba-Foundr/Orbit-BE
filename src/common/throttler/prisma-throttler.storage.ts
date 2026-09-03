import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { PrismaService } from '../../prisma/prisma.service';

// Railway runs this service across multiple replicas behind a load balancer,
// so @nestjs/throttler's default in-memory counter never sees a client's
// full request history — each replica counts independently and the limit
// effectively never triggers. This backs the counter with the Postgres
// instance every replica already shares, instead of adding a new Redis
// service just for this.
@Injectable()
export class PrismaThrottlerStorage implements ThrottlerStorage {
  constructor(private prisma: PrismaService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const recordKey = `${throttlerName}:${key}`;
    const now = new Date();

    const [row] = await this.prisma.$queryRaw<
      { hits: number; expiresAt: Date; blockedUntil: Date | null }[]
    >`
      INSERT INTO "RateLimitRecord" AS r ("key", "hits", "expiresAt", "blockedUntil")
      VALUES (${recordKey}, 1, ${now}::timestamp + (${ttl}::text || ' milliseconds')::interval, NULL)
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE
          WHEN r."blockedUntil" IS NOT NULL AND r."blockedUntil" > ${now} THEN r."hits"
          WHEN r."expiresAt" <= ${now} THEN 1
          ELSE r."hits" + 1
        END,
        "expiresAt" = CASE
          WHEN r."blockedUntil" IS NOT NULL AND r."blockedUntil" > ${now} THEN r."expiresAt"
          WHEN r."expiresAt" <= ${now} THEN ${now}::timestamp + (${ttl}::text || ' milliseconds')::interval
          ELSE r."expiresAt"
        END
      RETURNING "hits", "expiresAt", "blockedUntil"
    `;

    let { hits, expiresAt, blockedUntil } = row;
    let isBlocked = !!blockedUntil && blockedUntil.getTime() > now.getTime();

    if (!isBlocked && hits > limit) {
      blockedUntil = new Date(now.getTime() + blockDuration);
      await this.prisma.rateLimitRecord.update({
        where: { key: recordKey },
        data: { blockedUntil },
      });
      isBlocked = true;
    }

    return {
      totalHits: hits,
      timeToExpire: Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)),
      isBlocked,
      timeToBlockExpire: isBlocked && blockedUntil
        ? Math.max(0, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000))
        : 0,
    };
  }
}
