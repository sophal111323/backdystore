# Step 15 — Full Testing Report

## Scope

This step verifies the JASMINTOPUP backend + the JASMIN_DASHBOARD Flutter admin app after Step 14. It does not add Step 16 deployment work.

## Automated checks run in this environment

| Check | Result | Notes |
|---|---:|---|
| `npm ci` | PASS | Dependencies installed successfully. |
| `npm run lint` | PASS | No ESLint warnings/errors after minor lint cleanup. |
| Lightweight smoke test | PASS | 38/38 checks passed. See `step15-smoke-results.txt`. |
| Flutter import path check | PASS | All local Flutter imports resolve. |
| Required admin API route files | PASS | Auth, dashboard, orders, products, games, banners, settings, FAQ, promo codes, customers, audit logs, notifications, and public version route files exist. |
| Flutter secret scan | PASS | No database/backend secret env names found in Flutter Dart/YAML files. |
| Bearer token wiring | PASS | Flutter interceptor adds `Authorization: Bearer ...`. |
| 401 handling wiring | PASS | Flutter clears token / handles expired sessions. |
| Prisma model presence | PASS | `AdminLoginChallenge`, `AdminSession`, `Notification`, and main business models exist. |

## Automated checks blocked by environment

| Check | Status | Reason |
|---|---:|---|
| `npx prisma generate` | BLOCKED | Prisma tried to download engine from `binaries.prisma.sh`, but this environment could not resolve that host. Run this on your PC/server. |
| `npm run build` | BLOCKED | Build starts with `prisma generate`, so it is blocked by the same Prisma engine download issue here. |
| `flutter pub get` / `flutter analyze` / `flutter run` | BLOCKED | Flutter SDK is not installed in this environment. Run these locally. |
| Live login/order/product tests | BLOCKED | Requires a real database connection, admin account, TOTP setup, and running backend. |

## Fixes applied during Step 15

1. Fixed a React Hook lint warning in `app/order/page.tsx` by moving `startPolling` before `loadOrderByNumber` and adding the correct dependency.
2. Silenced two intentional `<img>` warnings in controlled places:
   - KHQR generated QR image
   - Maintenance logo image
3. Broadened audit `details` typing to support safe JSON logging of arrays and structured objects.
4. Added `scripts/step15-smoke-test.py` for repeatable structural testing.
5. Added this testing report and saved smoke test output.

## Production dependency audit note

`npm audit --omit=dev` reported 2 moderate production advisories related through `postcss`/`next`. I did not apply `npm audit fix --force` because npm suggested a major/breaking change path. Review with:

```bash
npm audit --omit=dev
```

Then upgrade carefully after confirming Next.js compatibility.

## Manual test checklist to run locally

### Backend setup

```bash
npm install
npx prisma generate
npx prisma db push
npm run build
npm run dev
```

### Flutter setup

```bash
cd jasmin_dashboard
flutter create --platforms=android,ios --project-name jasmin_dashboard .
flutter pub get
flutter analyze
flutter run --dart-define=JASMIN_API_BASE_URL=http://10.0.2.2:3000
```

### Auth tests

| Flow | Expected result |
|---|---|
| Wrong email/password | Generic invalid login error. |
| Correct email/password | Returns challenge and opens 2FA screen. |
| Wrong 2FA | Safe error, no dashboard access. |
| Correct 2FA | Token saved securely, dashboard opens. |
| Expired/invalid token | App clears token and returns to login. |
| Logout | Backend session revoked and local token cleared. |

### Admin feature tests

| Flow | Expected result |
|---|---|
| Dashboard loads | Stats, recent orders, system status appear. |
| Order status update | Order updates, audit log created, website order page refreshes. |
| Product edit/hide | Website game page reflects package change. |
| Game hide/show | Public games list updates. |
| Banner edit | Homepage updates. |
| Settings announcement/maintenance | Public layout updates within polling window. |
| FAQ create/hide | FAQ page updates. |
| Promo code create/edit | Promo code saved and usable state updates. |
| Customer ban/unban | Banlist behavior changes safely. |
| Audit logs | Admin actions appear. |
| Notifications | Badge updates and mark-read works. |
| App background/resume | Current data refreshes after resume. |

## Current verdict

The project passes all structural and lint checks available in this environment. Final production readiness still requires local/server validation with Prisma engine download, a real database, and Flutter SDK.
