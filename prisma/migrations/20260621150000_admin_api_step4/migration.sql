-- Step 4: Admin API support for JASMIN_DASHBOARD
-- Adds notifications used by the Flutter admin app for badges and new-order/update alerts.

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_readAt_idx" ON "Notification"("readAt");
CREATE INDEX IF NOT EXISTS "Notification_type_idx" ON "Notification"("type");
CREATE INDEX IF NOT EXISTS "Notification_targetType_targetId_idx" ON "Notification"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
