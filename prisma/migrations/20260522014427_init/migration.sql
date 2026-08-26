-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "totpSecret" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "supplierCode" TEXT;

-- CreateTable
CREATE TABLE "AdminAuthLock" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "forever" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAuthLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "orderNumber" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminAuthLock_identifier_key" ON "AdminAuthLock"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedWebhookEvent_transactionId_key" ON "ProcessedWebhookEvent"("transactionId");

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_processedAt_idx" ON "ProcessedWebhookEvent"("processedAt");

-- CreateIndex
CREATE INDEX "RateLimitEntry_key_createdAt_idx" ON "RateLimitEntry"("key", "createdAt");
