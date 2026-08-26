-- Migration: security_updates
-- Run with: npx prisma migrate dev --name security_updates

-- 1. Add TOTP secret field to Admin table
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;

-- 2. Create ProcessedWebhookEvent table (replay protection)
CREATE TABLE IF NOT EXISTS "ProcessedWebhookEvent" (
  "id"            TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "orderNumber"   TEXT,
  "processedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessedWebhookEvent_transactionId_key"
  ON "ProcessedWebhookEvent"("transactionId");
CREATE INDEX IF NOT EXISTS "ProcessedWebhookEvent_processedAt_idx"
  ON "ProcessedWebhookEvent"("processedAt");

-- 3. Create RateLimitEntry table (DB-backed rate limiting)
CREATE TABLE IF NOT EXISTS "RateLimitEntry" (
  "id"        TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "ip"        TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RateLimitEntry_key_createdAt_idx"
  ON "RateLimitEntry"("key", "createdAt");
