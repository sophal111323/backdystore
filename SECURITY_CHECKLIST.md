# JASMINTOPUP — Security Checklist (Issue #12)

This checklist covers all major security controls. Run through it before every
production deployment and after any significant code change.

---

## 1. Admin Login

**What to test:**
- [ ] Visit `/admin/sophallogin`. Enter a wrong password → should get a generic
  "Invalid email or password" error (no hint about whether the email exists).
- [ ] Enter wrong password **twice** → account should be permanently locked.
  Verify in DB: `AdminAuthLock` table has `forever=true` for the identifier.
- [ ] Enter wrong password **once** → account should be locked for 5 minutes.
- [ ] Confirm the login endpoint returns HTTP 429 for rate-limit violations (more
  than 10 attempts from the same IP in 15 minutes).
- [ ] Confirm correct password leads to the 2FA step (TOTP code prompt).

**How to check the DB:**
```sql
SELECT * FROM "AdminAuthLock" WHERE identifier LIKE 'admin-login:%';
```

---

## 2. TOTP 2FA

**Setup (first time only):**
1. Log in with password.
2. You'll be prompted to set up 2FA. Go to `/admin/settings` (or the setup
   prompt) and scan the QR code with Google Authenticator / Authy / 1Password.
3. Enter the 6-digit code to confirm setup.
4. From now on, every login requires the TOTP code.

**What to test:**
- [ ] Submit an invalid 6-digit code → should get an error + lock warning.
- [ ] Submit a **valid** TOTP code → should be fully logged in.
- [ ] Wait 30 seconds, get a new code → should still work (1-step clock window).
- [ ] Submit a code **twice** (replay) → second submission should fail because
  the window has passed.
- [ ] Confirm `Admin.totpSecret` in DB is set after setup (should be a 32-char
  base32 string, not "246810" or any static code).

**DB check:**
```sql
SELECT id, email, "totpSecret" IS NOT NULL as totp_configured FROM "Admin";
```

---

## 3. Payment Webhook Verification

**What to test:**
- [ ] Send a POST to `/api/payment/webhook/khpay` **without** the
  `X-Webhook-Signature` header → should return HTTP 401.
- [ ] Send with a **wrong** signature → should return HTTP 401.
- [ ] Send the **same** `transaction_id` twice → second request returns
  `{ ok: true, skipped: true, reason: "replay" }` and order is NOT updated again.
- [ ] Send with a mismatched `amount` → order status set to FAILED, returns HTTP 400.
- [ ] In development: confirm `PAYMENT_SIMULATION_MODE=true` works for test orders.
- [ ] In production: confirm `PAYMENT_SIMULATION_MODE` is **absent** or `false`.

**DB check for replay table:**
```sql
SELECT * FROM "ProcessedWebhookEvent" ORDER BY "processedAt" DESC LIMIT 10;
```

---

## 4. Rate Limits

**What to test (use curl or a script):**

| Endpoint | Limit |
|---|---|
| `POST /api/admin/auth` | 10 requests / 15 min / IP |
| `POST /api/admin/auth/2fa` | 10 requests / 15 min / IP |
| `POST /api/orders` | 10 requests / 10 min / IP |
| `POST /api/admin/upload` | 20 requests / 1 hour / admin ID |

For each:
- [ ] Send requests up to the limit → all succeed.
- [ ] Send one more → HTTP 429 with `{ "error": "Too many requests. Please try again later." }`.
- [ ] Check `RateLimitEntry` table for recorded hits.

**DB check:**
```sql
SELECT key, COUNT(*) as hits FROM "RateLimitEntry"
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY key ORDER BY hits DESC;
```

---

## 5. File Upload Restrictions

**What to test:**
- [ ] Upload a valid PNG → succeeds, returns Cloudinary URL.
- [ ] Upload a valid JPG → succeeds.
- [ ] Upload a valid WEBP → succeeds.
- [ ] Upload an **SVG** → should return HTTP 415 "Unsupported file type".
- [ ] Upload a **GIF** → should return HTTP 415.
- [ ] Upload a **PDF** → should return HTTP 415.
- [ ] Upload a file with a PNG extension but **wrong magic bytes** (e.g., rename a
  .exe to .png) → should return HTTP 415 "File content does not match".
- [ ] Upload without being logged in → should return HTTP 401.
- [ ] Upload a file > 5 MB → should return HTTP 413.

---

## 6. Production Environment Safety

**Before going live, verify all of the following:**

- [ ] `NODE_ENV=production` is set in your deployment.
- [ ] `PAYMENT_SIMULATION_MODE` is **not set** or is `false` in production env.
- [ ] `KHPAY_FALLBACK_TO_SIMULATION` is **not set** in production env.
- [ ] `ADMIN_JWT_SECRET` is at least 32 random characters (not "put-a-long-random…").
- [ ] `KHPAY_WEBHOOK_SECRET` is set and at least 16 characters.
- [ ] `DATABASE_URL` uses `?sslmode=require`.
- [ ] `Admin.totpSecret` is set for all admin accounts (not null).
- [ ] No admin account has password "sophal030511" or any other known default.
- [ ] The `ADMIN_PASSWORD` env var has been cleared or rotated after seeding.

**Quick production env check (run before deploy):**
```bash
# Should print nothing if all is safe
[[ "$NODE_ENV" == "production" ]] && \
  [[ -z "$PAYMENT_SIMULATION_MODE" || "$PAYMENT_SIMULATION_MODE" == "false" ]] && \
  [[ ${#ADMIN_JWT_SECRET} -ge 32 ]] && \
  echo "✅ Env looks safe" || echo "❌ Check your env vars"
```

---

## 7. Settings Masking

- [ ] Log in as admin, visit `/api/admin/settings` (GET) in the browser.
- [ ] Confirm `telegramBotToken` is shown as `"••••••••xxxx"` (last 4 chars only),
  **not** the full token.
- [ ] Update settings with a new Telegram bot token via the admin UI → should save correctly.
- [ ] Refresh page → masked value still shown, not the full token.

---

## 8. Session Lifetime

- [ ] After logging in, verify the `admin_token` cookie has `Max-Age=28800` (8 hours).
- [ ] Wait 8+ hours (or manually expire the cookie) → should redirect to login.
- [ ] Log out → `admin_token` and `admin_2fa_pending` cookies are both cleared.

---

## 9. Packages to Keep Updated

Run monthly or after any security advisory:
```bash
npm audit --audit-level=high
npx prisma --version
```

Key packages to monitor: `jsonwebtoken`, `bcryptjs`, `next`, `otplib`, `zod`.
