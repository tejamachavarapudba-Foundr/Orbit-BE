-- CreateTable
CREATE TABLE "RateLimitRecord" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "blockedUntil" TIMESTAMP(3),

    CONSTRAINT "RateLimitRecord_pkey" PRIMARY KEY ("key")
);
