# API Security Notes — Origin Guard, Webhook Hardening, Rate Limits

This document describes the API hardening layer added to the Order and Payment
APIs. It complements `SECURITY_CHECKLIST.md` and `PAYMENT_SECURITY_NOTES.md`.

---

## 1. API Origin Guard (middleware)

`lib/originGuard.ts` + `middleware.ts` enforce that **browser** calls to
`/api/*` are same-origin (or explicitly allowlisted). No CORS response headers
are emitted — foreign origins are refused instead (the public API is
same-origin by design, satisfying the spec's "no wildcard CORS" rule).

### Who passes / who is blocked

| Caller | Origin header | Sec-Fetch-Site | Result |
|---|---|---|---|
| Website itself (same origin) | present, = Host | same-origin | ✅ allowed |
| Allowlisted frontend | present, in allowlist | cross-site | ✅ allowed |
| Native Flutter app (iOS/Android) | **absent** | absent | ✅ allowed |
| curl / Postman / scripts | absent | absent | ✅ allowed |
| Uptime monitors | absent | absent | ✅ allowed |
| Foreign site via fetch()/XHR/iframe/img | absent/present | cross-site + non-navigate | ❌ 403 |
| Foreign cross-site form POST | present (foreign) | — | ❌ 403 (origin check) |
| Link click / redirect navigation to an API URL (e.g. invoice PDF from Telegram) | absent or present | cross-site + `mode: navigate` | ✅ allowed (PDF downloads and gateway return redirects keep working) |

### Configuration

- `API_ALLOWED_ORIGINS` — comma-separated full origins
  (e.g. `https://dytopup.site,https://www.dytopup.site`).
- `PUBLIC_APP_URL` / `NEXT_PUBLIC_BASE_URL` are also accepted as allowed origins.
- `http(s)://localhost:3000`-style origins are accepted **only when
  `NODE_ENV !== "production"`**.
- Requests with `Origin: null` (sandboxed iframe) are always rejected.

### Exemptions (signature/secret authenticated — never origin-gated)

`/api/payment/webhook/*`, `/api/webhooks/*`, `/api/cron/*`,
`/api/security/track`, `/api/health`, `/api/check-ip`, `/api/public/*`.

Blocked attempts are logged via `logSecurityEvent` (`origin_blocked`).

---

## 2. Webhook Hardening

### Tola Saint — `POST /api/payment/webhook/[method]`
1. HMAC-SHA256 signature verification (mandatory, fail-closed — unchanged).
2. **NEW:** optional IP allowlist — `TOLA_SAINT_WEBHOOK_ALLOWED_IPS`
   (comma-separated exact IPs or IPv4 CIDRs, e.g.
   `"203.0.113.7,198.51.100.0/24"`). When unset, any IP may attempt delivery
   and must still pass the HMAC. When set, non-matching IPs get 403 before
   any parsing.
3. Amount/currency validation, idempotency (replay table) — unchanged.

### FrozenYuki — `POST /api/webhooks/frozenyuki`
1. **NEW: FAIL-CLOSED in production** — if
   `FROZENYUKI_WEBHOOK_SECRET`/`SORATOPUP_WEBHOOK_SECRET` is not configured,
   the webhook returns 403 (`webhook_secret_missing` security log). Previously
   an unsigned (forgeable) `"Success"` payload could mark orders DELIVERED.
   Non-production environments keep the lenient behavior for local testing.
2. HMAC-SHA256 signature verification when the secret is configured (unchanged).
3. **NEW:** optional IP allowlist — `FROZENYUKI_WEBHOOK_ALLOWED_IPS` (same
   format as above).

IP allowlist semantics (`lib/ipAllowlist.ts`): empty/unset → allow everyone;
set → request IP must match an entry; unknown/unresolvable IP → reject
(fail-closed); IPv6-mapped IPv4 (`::ffff:1.2.3.4`) is normalized.

> Gateway IP ranges: get them from the Tola Saint / FrozenYuki (SoraTopup)
> dashboards or support before setting the allowlist vars. A misconfigured
> allowlist blocks real webhook deliveries (fail-closed by design) — verify
> with a test transaction after enabling.

---

## 3. Order Creation Rate Limits

`POST /api/orders` keeps its DB-backed per-IP rate limit (survives restarts
and multi-instance serverless deploys) but the values are now env-tunable:

| Env var | Default | Bounds |
|---|---|---|
| `ORDER_RATE_LIMIT_MAX` | 10 | 1–1000 |
| `ORDER_RATE_LIMIT_WINDOW_MS` | 600000 (10 min) | 1 000 – 86 400 000 |

Defaults are unchanged (10 orders / 10 minutes / IP), so existing behavior and
the `SECURITY_CHECKLIST.md` table remain valid. Invalid values safely fall
back to defaults.

Authentication model for `POST /api/orders` (unchanged by design — guest
checkout, no user accounts; the spec forbids backward-incompatible changes):
origin guard → Cloudflare Turnstile token → per-IP rate limit → zod
validation → banlist checks. Admin order access goes through
`GET /api/orders` (`withAdminAuth`, `orders.read`).

---

## 4. Internal / Server-to-Server Routing

There is no user account system — "internal" here means server-to-server
endpoints (webhooks, cron, middleware's tracker). Current protections:

| Endpoint | Auth gate | Origin guard |
|---|---|---|
| `/api/payment/webhook/[method]` | HMAC-SHA256 (+ optional IP allowlist) | exempt |
| `/api/webhooks/frozenyuki` | HMAC-SHA256, **required in production** (+ optional IP allowlist) | exempt |
| `/api/cron/*` | `CRON_SECRET` (Bearer) | exempt |
| `/api/security/track` | `INTERNAL_SECURITY_SECRET` (Bearer, called only by middleware) | exempt |
| `/api/payment/simulate` | `PAYMENT_SIMULATION_MODE` (non-production only) + rate limit | guarded |
| `/api/admin/**` | `withAdminAuth` JWT cookie/Bearer + permissions | guarded |

### Optional: Vercel Firewall (network-level defense-in-depth)

If you want network-layer IP filtering for webhooks before requests reach the
app, use the **Vercel dashboard** (Project → Settings → Firewall) rather than
`vercel.json`: create a rule scoped to `/api/payment/webhook/*` and
`/api/webhooks/*` that blocks traffic unless the source IP is in the gateway's
published ranges. Keep the app-level checks in this document as the source of
truth — the dashboard firewall is an optional outer ring.

Vercel cron endpoints already receive `Authorization: Bearer ${CRON_SECRET}`
(verified in code); no further middleware token gate is required.

---

## 5. Manual Verification

```bash
# 1. Origin guard: foreign browser origin is refused
curl -i -X POST https://YOUR-DOMAIN/api/orders \
  -H "Origin: https://evil.example" -H "Content-Type: application/json" -d "{}"
# → 403 Forbidden

# 2. No-Origin callers still pass (native app parity)
curl -i -X POST https://YOUR-DOMAIN/api/orders -H "Content-Type: application/json" -d "{}"
# → 400 (zod validation), NOT 403

# 3. Webhooks reject unsigned payloads in production
curl -i -X POST https://YOUR-DOMAIN/api/webhooks/frozenyuki \
  -H "Content-Type: application/json" -d '{"event":"order.update","status":"Success"}'
# → 403 (secret missing/invalid) — order is NOT marked DELIVERED

# 4. IP allowlist active (after setting e.g. TOLA_SAINT_WEBHOOK_ALLOWED_IPS)
curl -i -X POST https://YOUR-DOMAIN/api/payment/webhook/tolasaint -d "{}"
# → 403 Forbidden (IP not allowlisted) before signature processing
```

After deployment, watch logs for `origin_blocked`, `webhook_ip_blocked`,
`webhook_secret_missing`, and `webhook_invalid_signature` security events
(`SECURITY` level JSON lines).

