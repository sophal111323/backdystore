-- Payment security hardening
-- Adds a unique constraint for provider transaction references.
-- PostgreSQL allows multiple NULL values in a UNIQUE index, so unpaid/manual
-- orders without paymentRef are still allowed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Order"
    WHERE "paymentRef" IS NOT NULL
    GROUP BY "paymentRef"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create unique index Order_paymentRef_key: duplicate non-null paymentRef values exist. Resolve duplicates first.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_paymentRef_key" ON "Order"("paymentRef");
