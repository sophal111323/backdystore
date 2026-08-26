-- Public sync settings for Website + Flutter App shared backend config.
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "supportTikTok" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "announcementEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "appMinSupportedVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "appLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "appForceUpdate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "appUpdateUrl" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "ordersEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "paymentsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "promosEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Keep existing announcement text visible after migration when it already exists.
UPDATE "Settings"
SET "announcementEnabled" = true
WHERE "announcement" IS NOT NULL AND length(trim("announcement")) > 0;
