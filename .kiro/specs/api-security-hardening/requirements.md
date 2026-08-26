# Requirements — API Security Hardening (JASMINTOPUP)

## Introduction

JASMINTOPUP is a Next.js (App Router) + TypeScript + Prisma/PostgreSQL application on Vercel, with a public customer website and an admin panel, plus a Flutter admin app that consumes the same backend APIs. A prior audit established that the codebase is already strongly secured in many areas (Prisma `select` allowlists on public game/product routes, DB-backed rate limiting on sensitive endpoints, JWT HttpOnly/SameSite cookies, TOTP 2FA with lockout, webhook HMAC verification, server-side payment validation, middleware CSP and security headers, secure logging, and image-upload validation).

This spec defines the remaining, deliberately-scoped hardening work: completing a full route security map, introducing reusable response/mapper/validation helpers where they reduce risk, ensuring consistent safe error handling, confirming rate-limit and header coverage, and standardizing response handling — all WITHOUT breaking the live website or the Flutter app.

The single most important constraint: existing API response shapes consumed by the website and Flutter app MUST remain backward compatible. Any new standardized envelope (e.g. `{ success, data }`) may only be introduced on new routes or behind explicit opt-in, never by silently changing a response shape an existing client depends on.

## Glossary

- Public API: callable by anyone, no authentication (e.g. `/api/games`, `/api/products`, `/api/orders` create, order tracking, `/api/settings/public`).
- Admin-only API: under `/api/admin/*`, requires a valid admin session and permission.
- Payment/Internal API: payment webhooks, simulation, cron, and security endpoints.
- Sensitive field: any field that must never reach a public client — `costPrice`, profit/margin, supplier identifiers/keys/secrets, `adminNote`/internal notes, `passwordHash`, `totpSecret`, session tokens, payment/webhook secrets, raw provider payloads, `ipAddress`, `userAgent`, environment values.

## Requirements

### Requirement 1: Complete route security map

**User Story:** As the project owner, I want a documented classification of every API route, so that I know which routes are public, admin-only, or payment/internal and what each is allowed to expose.

#### Acceptance Criteria
1. WHEN the audit is produced THEN every route under `app/api/**` (and `pages/api/**` if present) SHALL be listed with a classification of Public, Admin-only, or Payment/Internal.
2. WHEN a route is classified THEN the map SHALL record whether it requires auth, validates input, applies rate limiting, and which sensitive fields (if any) it must exclude.
3. IF a route referenced in the original request does not exist (e.g. `/api/games/[slug]`) THEN the map SHALL note its absence and where that data is actually served.

### Requirement 2: Public APIs expose only allowlisted fields

**User Story:** As a customer, I want public APIs to return only the data the UI needs, so that internal/cost/supplier data is never exposed.

#### Acceptance Criteria
1. WHEN a public API queries Prisma THEN it SHALL use an explicit `select` (or a mapper over a `select`) and SHALL NOT use broad `include` that pulls unsafe fields.
2. WHEN a public API returns game/product/order data THEN the response SHALL NOT contain `costPrice`, profit/margin, supplier fields, `adminNote`/internal notes, `passwordHash`, `totpSecret`, tokens, payment/provider secrets, raw provider payloads, `ipAddress`, or `userAgent`.
3. WHEN public game/product lists are returned THEN only `active` records SHALL be included.
4. WHERE a reusable mapper improves consistency THEN mapper helpers MAY be added under `lib/mappers/` and applied without changing the existing field names the frontend/app already consume.

### Requirement 3: Backward-compatible response shapes

**User Story:** As the owner, I want the website and Flutter app to keep working, so that hardening does not cause outages.

#### Acceptance Criteria
1. WHEN an existing public or admin route's response shape is consumed by the website or Flutter app THEN that shape SHALL remain unchanged (same top-level type and field names) after hardening.
2. IF a standardized `{ success, data }` envelope is desired THEN it SHALL only be applied to brand-new routes or via an explicit, separately-reviewed migration — never silently to an existing route.
3. WHEN field-level hardening removes a value from a response THEN there SHALL be confirmation (via code search) that no website page or Flutter screen reads that field before removal.

### Requirement 4: Input validation on all public inputs

**User Story:** As the owner, I want all public inputs validated, so that malformed or malicious input is rejected safely.

#### Acceptance Criteria
1. WHEN a public route accepts a slug, id, order number, player UID, zone/server id, phone, amount, currency, promo code, transaction id, pagination, or search param THEN it SHALL validate the input (Zod preferred; manual validation acceptable) before use.
2. IF validation fails THEN the route SHALL return HTTP 400 with a short safe message and SHALL NOT echo internal validation details or stack traces.
3. WHEN a slug is validated THEN it SHALL match a strict pattern (lowercase alphanumeric and hyphen) and reject path-traversal input.

### Requirement 5: Every admin route is protected via a shared helper

**User Story:** As the owner, I want a single admin-auth helper used everywhere, so that no admin route has weak or duplicated auth logic.

#### Acceptance Criteria
1. WHEN any `/api/admin/*` route is called without a valid admin session THEN it SHALL return 401.
2. WHEN an authenticated admin lacks the required permission THEN the route SHALL return 403.
3. WHEN admin routes respond THEN they SHALL set `Cache-Control: no-store` and SHALL NOT expose secrets (password hash, TOTP secret, tokens, env values, supplier keys).
4. WHERE duplicated admin-auth logic exists THEN it SHALL be consolidated onto the shared helper without weakening any check (2FA and lockout behavior preserved).

### Requirement 6: Order and payment integrity

**User Story:** As the owner, I want prices and payment status controlled only by the server, so that customers cannot tamper with orders.

#### Acceptance Criteria
1. WHEN an order is created THEN the server SHALL compute the price from the database and SHALL ignore any client-supplied price, cost, supplier, or status fields.
2. WHEN an order is created THEN it SHALL be rejected if the game or product is inactive.
3. WHEN a payment status changes to PAID THEN it SHALL occur only via verified webhook or authorized admin override, never from a public client.
4. WHEN a payment is verified THEN order number, amount, currency, and transaction id SHALL be checked, duplicate transaction ids SHALL be rejected, and only a PENDING order SHALL be allowed to transition to PAID.
5. WHEN order data is returned to a public client THEN sensitive/internal fields SHALL be excluded and contact fields SHALL be masked where already done.

### Requirement 7: Payment simulation is not publicly usable in production

**User Story:** As the owner, I want simulation locked down in production, so that nobody can fake payments.

#### Acceptance Criteria
1. WHEN `/api/payment/simulate` is called in production THEN it SHALL be disabled (404) or require admin authorization.
2. WHEN simulation runs in non-production THEN it SHALL still not allow setting PAID on orders that fail standard payment validation.

### Requirement 8: Safe error handling everywhere

**User Story:** As a user, I want errors to be safe, so that no stack trace, Prisma detail, table name, file path, or env value leaks.

#### Acceptance Criteria
1. WHEN any route throws THEN the public response SHALL be a short safe message with an appropriate status code, and the raw error SHALL be logged server-side only.
2. WHEN an error is returned THEN it SHALL NOT include `error.stack`, raw Prisma error text, database identifiers, file paths, or environment values.
3. WHERE reusable error/success helpers reduce duplication THEN they MAY be added under `lib/api/` and used for new or refactored code without breaking existing response shapes.

### Requirement 9: Rate-limit coverage on sensitive endpoints

**User Story:** As the owner, I want brute-force and abuse protection, so that auth and write endpoints are throttled.

#### Acceptance Criteria
1. WHEN admin login, admin 2FA, order creation, payment verification, and promo-code check endpoints are called repeatedly THEN they SHALL be rate limited and return 429 when exceeded.
2. WHERE rate limiting must survive serverless multi-instance deployment THEN the DB-backed limiter SHALL be used; any in-memory fallback SHALL be clearly marked dev-only.
3. WHEN a rate limit triggers THEN the response SHALL be a short safe message and SHALL NOT reveal internal thresholds beyond standard `Retry-After`.

### Requirement 10: Security headers and safe CORS

**User Story:** As the owner, I want safe headers and CORS, so that the app resists framing, sniffing, and cross-origin abuse.

#### Acceptance Criteria
1. WHEN any response is returned THEN baseline headers SHALL be present: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY` (or CSP frame-ancestors), and `Permissions-Policy` restricting camera/microphone/geolocation.
2. WHEN admin or payment routes respond THEN they SHALL use `Cache-Control: no-store`.
3. WHEN CORS is evaluated THEN admin and payment APIs SHALL NOT use `Access-Control-Allow-Origin: *`, and credentialed responses SHALL NOT be combined with a wildcard origin; allowed origins SHALL come from configuration.

### Requirement 11: Mass-assignment prevention

**User Story:** As the owner, I want writes to use explicit field allowlists, so that clients cannot set protected fields.

#### Acceptance Criteria
1. WHEN any Prisma `create`/`update` runs from request input THEN it SHALL map only explicitly-allowed fields and SHALL NOT spread a raw request body.
2. WHEN a write occurs THEN protected fields (role, isAdmin, price, costPrice, supplier fields, paymentStatus/orderStatus from public clients, passwordHash, totpSecret, createdBy/updatedBy, deletedAt, internal/admin notes) SHALL NOT be settable by public clients.

### Requirement 12: Environment variable and logging safety

**User Story:** As the owner, I want secrets kept server-side and out of logs, so that nothing sensitive leaks.

#### Acceptance Criteria
1. WHEN environment variables are used THEN no server secret SHALL be exposed via a `NEXT_PUBLIC_` name, and no route SHALL return env values.
2. WHEN logging occurs THEN passwords, OTP/TOTP codes, tokens, payment/webhook secrets, API keys, supplier keys, and database URLs SHALL NOT be logged; sensitive values SHALL be masked.

### Requirement 13: Verification and no regressions

**User Story:** As the owner, I want the project to still build and lint cleanly, so that hardening introduces no breakage.

#### Acceptance Criteria
1. WHEN changes are complete THEN `npm run lint`, `npm run build`, and `npx prisma generate` SHALL succeed (and `npm run typecheck` if present).
2. WHEN changes are complete THEN there SHALL be no broken imports, unused symbols introduced by the changes, disabled auth, or temporary security bypasses.
3. WHEN public/admin/payment behaviors are tested per the manual test commands THEN observed results SHALL match the documented expectations.

## Out of Scope / Requires Explicit Approval

- Changing existing response shapes that the website or Flutter app depend on (Requirement 3 forbids silent changes).
- Any destructive database action (migrate reset, schema-destructive change, data deletion).
- Rotating secrets, modifying payment provider settings, or deploying to production.
- Adding CORS wildcards to private APIs, or any change that disables auth, 2FA, or payment protections.

Report exactly which file(s) you created.
