# Payment Security Hardening Notes

> **Provider update:** The real payment provider is now **Tola Saint**
> (https://tolasaint.com/docs). All KHPay-specific code has been replaced.
> Where this document says "KHPay", read "Tola Saint". The validation rules
> below are unchanged and still apply.

## What changed

### 1. Strict shared payment validation
Added `lib/payment-validation.ts` with shared helpers:

- `normalizeCurrency(currency)`
- `amountsMatch(expected, actual)`
- `isRemotePaid(remote)`
- `validatePaymentForOrder(order, remotePayment)`
- `assertProductionPaymentConfig()`
- `assertRealTolaSaintConfig()`

The same validation logic is now used by:

- `app/api/payment/webhook/[method]/route.ts`
- `app/api/admin/orders/[orderNumber]/refresh/route.ts`
- `app/api/orders/[orderNumber]/route.ts` for development-only public sync

### 2. Webhook hardening
The Tola Saint webhook now requires all of these before `PAID`:

- webhook `orderNumber` exists and exactly matches `order.orderNumber`
- webhook `transaction_id` exists
- `order.paymentRef` exists
- webhook `transaction_id === order.paymentRef`
- webhook amount matches `order.amountUsd`
- webhook currency matches `order.currency`

Invalid transaction, amount, currency, or missing reference cases are rejected with safe JSON errors and security logs.

Replay protection is improved by creating `ProcessedWebhookEvent` inside the same Prisma transaction that marks the order paid. Duplicate transaction IDs are treated as replay and skipped.

### 3. Simulation mode is explicit only
Simulation is now enabled only when:

```env
PAYMENT_SIMULATION_MODE=true
```

Missing `TOLA_SAINT_API_KEY` no longer enables simulation.

In production:

- `PAYMENT_SIMULATION_MODE=true` throws a configuration error
- missing `TOLA_SAINT_API_KEY` throws a configuration error
- missing `TOLA_SAINT_WEBHOOK_SECRET` makes every webhook fail signature verification (fail closed)

Unsupported payment methods (`ABA`, `ACLEDA`, `WING`, etc.) no longer silently simulate in real mode.

### 4. Public order status route is read-only in production
`app/api/orders/[orderNumber]/route.ts` no longer marks orders `PAID` in production.

Optional development-only sync requires:

```env
ALLOW_PUBLIC_PAYMENT_SYNC=true
NODE_ENV !== production
```

Even then, it validates transaction ID, amount, and currency before changing status.

### 5. Admin refresh validation
Admin refresh still requires admin auth through `withAdminAuth`, but now also validates:

- order is `PENDING`
- `order.paymentRef` exists
- remote payment is paid
- remote transaction matches `order.paymentRef`
- remote amount matches `order.amountUsd`
- remote currency matches `order.currency`

Validation failure returns a clear safe error and does not update order status.

### 6. Unique paymentRef
`prisma/schema.prisma` now uses:

```prisma
paymentRef String? @unique
```

A migration was added:

```text
prisma/migrations/20260602080000_payment_security_hardening/migration.sql
```

This migration checks for duplicate non-null `paymentRef` values first. If duplicates exist, it stops with a clear error instead of silently corrupting order history.

## Safe migration steps

Run this first to check duplicates:

```sql
SELECT "paymentRef", COUNT(*)
FROM "Order"
WHERE "paymentRef" IS NOT NULL
GROUP BY "paymentRef"
HAVING COUNT(*) > 1;
```

If the query returns rows, fix duplicates before applying the migration. Usually that means keeping the correct paid order reference and setting incorrect duplicate `paymentRef` values to `NULL` or a corrected provider transaction ID after manual review.

Then run:

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run build
npm run lint
```

For production deployment after testing locally:

```bash
npx prisma migrate deploy
npm run build
```

## Manual test cases

1. Valid webhook with correct `orderNumber`, `transaction_id`, amount, currency → order becomes `PAID`.
2. Webhook with correct `orderNumber` but wrong `transaction_id` → `400`, order stays `PENDING`.
3. Webhook with wrong amount → `400`, order stays `PENDING`.
4. Webhook with wrong currency → `400`, order stays `PENDING`.
5. Missing `KHPAY_API_KEY` in production → configuration error, no simulation fallback.
6. `PAYMENT_SIMULATION_MODE=true` in production → configuration error.
7. Public order GET in production → read-only, never marks `PAID`.
8. Admin refresh with valid remote paid payment → order becomes `PAID`.
9. Admin refresh with amount/currency mismatch → `400`, order stays `PENDING`.
