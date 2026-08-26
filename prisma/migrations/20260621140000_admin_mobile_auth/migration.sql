-- Admin mobile auth support for JASMIN_DASHBOARD
-- Adds challenge/session tables for Flutter Bearer-token login while keeping the existing web cookie auth.

-- Audit logs get optional mobile-auth context fields.
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "adminId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

CREATE INDEX IF NOT EXISTS "AuditLog_adminId_idx" ON "AuditLog"("adminId");

-- Temporary challenge after email/password, before Google Authenticator 2FA.
CREATE TABLE IF NOT EXISTS "AdminLoginChallenge" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "usedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminLoginChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminLoginChallenge_adminId_idx" ON "AdminLoginChallenge"("adminId");
CREATE INDEX IF NOT EXISTS "AdminLoginChallenge_expiresAt_idx" ON "AdminLoginChallenge"("expiresAt");
CREATE INDEX IF NOT EXISTS "AdminLoginChallenge_usedAt_idx" ON "AdminLoginChallenge"("usedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminLoginChallenge_adminId_fkey'
  ) THEN
    ALTER TABLE "AdminLoginChallenge"
      ADD CONSTRAINT "AdminLoginChallenge_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Revocable hashed Bearer-token sessions for Flutter/mobile admin.
CREATE TABLE IF NOT EXISTS "AdminSession" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),

  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "AdminSession_adminId_idx" ON "AdminSession"("adminId");
CREATE INDEX IF NOT EXISTS "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "AdminSession_revokedAt_idx" ON "AdminSession"("revokedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminSession_adminId_fkey'
  ) THEN
    ALTER TABLE "AdminSession"
      ADD CONSTRAINT "AdminSession_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
