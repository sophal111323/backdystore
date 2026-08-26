> **âš ï¸ OBSOLETE (payment sections):** This document predates the migration from KHPay to Tola Saint.
> Any KHPay configuration in this file is no longer valid. See DEPLOY.md and README.md for the
> current Tola Saint setup (https://tolasaint.com/docs).

# Step 16 — Final Deployment Instructions

This step explains how to run, build, and deploy the full JASMINTOPUP system with the connected Flutter admin app `JASMIN_DASHBOARD`.

## 1. What you are deploying

The final project has two connected parts:

| Part | Folder | Purpose |
|---|---|---|
| JASMINTOPUP website/backend | project root | Next.js storefront, admin APIs, Prisma, PostgreSQL |
| JASMIN_DASHBOARD Flutter app | `jasmin_dashboard/` | Admin-only mobile app using secure Bearer token auth |

Data flow:

```txt
Flutter admin app
  -> secure admin API with Bearer token
  -> Prisma/PostgreSQL database
  -> public website reads latest data
  -> public pages refresh through dynamic data + version polling
```

Important rule: the Flutter app never edits website files directly. It only talks to the backend API.

---

## 2. Requirements

### Website/backend

- Node.js 22.x recommended because `package.json` sets `engines.node` to `22.x`.
- npm
- PostgreSQL database, recommended: Neon PostgreSQL.
- Production HTTPS domain, for example `https://www.jasmintopup.site`.

### Flutter app

- Flutter stable SDK
- Dart SDK included with Flutter
- Android Studio for Android builds
- Xcode + Apple developer setup for iOS builds

---

## 3. Backend environment variables

Create `.env` locally from `.env.example`:

```bash
cp .env.example .env
```

Minimum required for local testing:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
ADMIN_EMAIL="your-admin-email@example.com"
ADMIN_PASSWORD="YourStrongPassword123!"
ADMIN_JWT_SECRET="put-a-long-random-secret-at-least-32-chars-here"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
PUBLIC_APP_URL="http://localhost:3000"
PAYMENT_SIMULATION_MODE="true"
PUBLIC_DATA_REVALIDATE_SECONDS="10"
ADMIN_LOGIN_CHALLENGE_TTL_SECONDS="300"
ADMIN_MOBILE_SESSION_TTL_SECONDS="28800"
```

Production minimum:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
ADMIN_JWT_SECRET="long-random-production-secret"
NEXT_PUBLIC_BASE_URL="https://www.jasmintopup.site"
PUBLIC_APP_URL="https://www.jasmintopup.site"
PUBLIC_DATA_REVALIDATE_SECONDS="10"
ADMIN_LOGIN_CHALLENGE_TTL_SECONDS="300"
ADMIN_MOBILE_SESSION_TTL_SECONDS="28800"
PAYMENT_SIMULATION_MODE="false"
ALLOW_PUBLIC_PAYMENT_SYNC="false"
KHPAY_BASE_URL="https://khpay.site/api/v1"
KHPAY_API_KEY="your-real-khpay-api-key"
KHPAY_WEBHOOK_SECRET="your-real-khpay-webhook-secret"
INTERNAL_SECURITY_SECRET="long-random-secret"
CRON_SECRET="long-random-secret"
```

Optional production variables:

```env
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
CAMRAPID_BASE_URL="https://partner.camrapidsecure.com/api"
CAMRAPID_API_KEY=""
CLOUDFLARE_API_TOKEN=""
CLOUDFLARE_ZONE_ID=""
CLOUDFLARE_ALERT_THRESHOLDS="1K,10K,20K,50K,100K,200K,500K,1M,2M,5M,10M,20M"
CLOUDFLARE_ALERT_METRIC="protected"
```

Security rules:

- Never commit `.env`.
- Never put database URL, KHPay API key, JWT secret, or TOTP secret in Flutter.
- Keep `PAYMENT_SIMULATION_MODE=false` in production.
- Keep `ALLOW_PUBLIC_PAYMENT_SYNC=false` in production.

---

## 4. Local backend setup

From the project root:

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Open:

```txt
http://localhost:3000
http://localhost:3000/admin/sophallogin
```

The seed requires:

```env
ADMIN_EMAIL="your-admin-email@example.com"
ADMIN_PASSWORD="YourStrongPassword123!"
```

After first login, set up Google Authenticator 2FA from the admin flow. The Flutter dashboard will not open until 2FA passes.

---

## 5. Local Flutter setup

Go to the Flutter folder:

```bash
cd jasmin_dashboard
```

If `android/` and `ios/` folders are missing, generate them:

```bash
flutter create --platforms=android,ios --project-name jasmin_dashboard .
```

Then install packages:

```bash
flutter pub get
flutter analyze
```

Run on Android emulator:

```bash
flutter run --dart-define=JASMIN_API_BASE_URL=http://10.0.2.2:3000
```

Run on physical Android phone on same Wi-Fi:

```bash
flutter run --dart-define=JASMIN_API_BASE_URL=http://YOUR_PC_LAN_IP:3000
```

Run against production:

```bash
flutter run --dart-define=JASMIN_API_BASE_URL=https://www.jasmintopup.site
```

Do not include a trailing slash in `JASMIN_API_BASE_URL`.

---

## 6. Deploy website/backend to Vercel

### Step 1 — Push project to GitHub

```bash
git init
git add .
git commit -m "JASMINTOPUP with Flutter admin dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2 — Create database

Use Neon PostgreSQL or another PostgreSQL provider.

Copy the production connection string and keep `sslmode=require`.

### Step 3 — Add project to Vercel

1. Open Vercel.
2. Import your GitHub repository.
3. Framework preset: Next.js.
4. Build command: `npm run build`.
5. Install command: default or `npm install`.
6. Output directory: default.

### Step 4 — Add environment variables in Vercel

Add at least:

```env
DATABASE_URL=
ADMIN_JWT_SECRET=
NEXT_PUBLIC_BASE_URL=https://www.jasmintopup.site
PUBLIC_APP_URL=https://www.jasmintopup.site
PUBLIC_DATA_REVALIDATE_SECONDS=10
ADMIN_LOGIN_CHALLENGE_TTL_SECONDS=300
ADMIN_MOBILE_SESSION_TTL_SECONDS=28800
PAYMENT_SIMULATION_MODE=false
ALLOW_PUBLIC_PAYMENT_SYNC=false
KHPAY_BASE_URL=https://khpay.site/api/v1
KHPAY_API_KEY=
KHPAY_WEBHOOK_SECRET=
INTERNAL_SECURITY_SECRET=
CRON_SECRET=
```

For first seed only, also set:

```env
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=YourStrongPassword123!
```

After the first admin is created, you can remove `ADMIN_PASSWORD` from production env if you do not need to seed again.

### Step 5 — Migrate database

Preferred safe method from your PC:

```bash
DATABASE_URL="your-production-postgres-url" npx prisma migrate deploy
DATABASE_URL="your-production-postgres-url" npm run db:seed
```

Alternative for early development only:

```bash
DATABASE_URL="your-production-postgres-url" npx prisma db push
DATABASE_URL="your-production-postgres-url" npm run db:seed
```

### Step 6 — Deploy

Click Deploy in Vercel, or push to GitHub after env variables are set.

After deployment, test:

```txt
https://www.jasmintopup.site
https://www.jasmintopup.site/admin/sophallogin
https://www.jasmintopup.site/api/settings/public
https://www.jasmintopup.site/api/public/version?scope=home
```

---

## 7. Connect Spaceship domain to Vercel

For root domain:

| Type | Name | Value |
|---|---|---|
| A | `@` | Vercel A record value shown in Vercel dashboard |

For `www`:

| Type | Name | Value |
|---|---|---|
| CNAME | `www` | Vercel CNAME value shown in Vercel dashboard |

If Vercel says the domain is linked to another account, add the TXT verification record exactly as Vercel shows:

| Type | Name | Value |
|---|---|---|
| TXT | `_vercel` or `_vercel.yourdomain` | `vc-domain-verify=...` |

After verification, set these env values to the final domain:

```env
NEXT_PUBLIC_BASE_URL=https://www.jasmintopup.site
PUBLIC_APP_URL=https://www.jasmintopup.site
```

Redeploy after changing env variables.

---

## 8. KHPay production setup

In production:

```env
PAYMENT_SIMULATION_MODE=false
ALLOW_PUBLIC_PAYMENT_SYNC=false
KHPAY_BASE_URL=https://khpay.site/api/v1
KHPAY_API_KEY=your-real-key
KHPAY_WEBHOOK_SECRET=your-real-webhook-secret
```

Important checks:

- Webhook must verify signature.
- Webhook must match order number.
- Webhook must match transaction/payment reference.
- Webhook must match amount and currency.
- Only pending/valid orders should become paid.
- Do not mark paid from public client input.
- Keep payment simulation disabled in production.

---

## 9. Build Android APK

From `jasmin_dashboard/`:

```bash
flutter clean
flutter pub get
flutter analyze
flutter build apk --release --dart-define=JASMIN_API_BASE_URL=https://www.jasmintopup.site
```

APK output:

```txt
build/app/outputs/flutter-apk/app-release.apk
```

Install on Android phone:

```bash
adb install build/app/outputs/flutter-apk/app-release.apk
```

For Google Play style bundle:

```bash
flutter build appbundle --release --dart-define=JASMIN_API_BASE_URL=https://www.jasmintopup.site
```

AAB output:

```txt
build/app/outputs/bundle/release/app-release.aab
```

---

## 10. Prepare iOS build

From `jasmin_dashboard/`:

```bash
flutter clean
flutter pub get
flutter analyze
flutter build ios --release --dart-define=JASMIN_API_BASE_URL=https://www.jasmintopup.site
```

Then open iOS project:

```bash
open ios/Runner.xcworkspace
```

In Xcode:

1. Set Bundle Identifier.
2. Set Signing Team.
3. Set App Icon and display name.
4. Archive the app.
5. Upload with Xcode Organizer or Transporter.

You need an Apple Developer account for real App Store/TestFlight distribution.

---

## 11. Flutter production API URL

Use production domain:

```bash
--dart-define=JASMIN_API_BASE_URL=https://www.jasmintopup.site
```

For emulator local backend:

```bash
--dart-define=JASMIN_API_BASE_URL=http://10.0.2.2:3000
```

For physical phone local backend:

```bash
--dart-define=JASMIN_API_BASE_URL=http://YOUR_PC_LAN_IP:3000
```

If the phone cannot connect locally:

- Make sure phone and PC are on same Wi-Fi.
- Use your PC LAN IP, not `localhost`.
- Allow Node.js through Windows Firewall.
- Start backend with `npm run dev`.

---

## 12. Final test checklist

### Auth

| Test | Expected |
|---|---|
| Wrong password | Generic invalid credentials error |
| Correct password | Returns 2FA challenge |
| Wrong 2FA | Error, no dashboard access |
| Correct 2FA | Flutter receives Bearer token |
| Reopen Flutter | `/api/admin/auth/me` restores session |
| Logout | backend session revoked and local token cleared |
| Expired token | app returns to login |

### Admin update flow

| Test | Expected |
|---|---|
| Edit product in Flutter | Website game page updates |
| Disable game in Flutter | Public site hides game |
| Update banner | Homepage updates |
| Update announcement | Announcement bar updates |
| Turn maintenance on/off | Public gate updates |
| Update FAQ | FAQ page updates |
| Update order status | Order tracking page updates |
| Create promo code | Code becomes available through backend |
| Ban customer | Matching identity blocked |
| Mark notification read | Badge count decreases |

### Security

| Test | Expected |
|---|---|
| Public API returns settings | No secrets included |
| Admin API without token | 401 |
| Admin API with invalid token | 401 |
| Support role accesses products/settings | Forbidden if role lacks permission |
| Payment simulation in production | Disabled |
| KHPay webhook mismatch | Rejected |
| Audit log after admin update | New log exists |

---

## 13. Production security checklist

Before launch:

- Use HTTPS only.
- Use strong `ADMIN_JWT_SECRET`.
- Use strong admin password.
- Enable Google Authenticator 2FA.
- Keep production payment simulation off.
- Keep public payment sync off.
- Store only hashed session tokens in DB.
- Never expose raw TOTP secret to Flutter.
- Never expose database URL/API secrets to Flutter.
- Rotate KHPay keys if they were pasted in chat or shared anywhere.
- Confirm admin APIs require Bearer token or secure cookie.
- Confirm public APIs do not return admin notes, bot token, database URL, or private logs.
- Confirm Vercel env variables are set for Production and Preview only as needed.
- Keep `.env` out of Git.
- Use database backups.
- Review audit logs after first real admin actions.

---

## 14. Recommended launch order

1. Run backend locally.
2. Run Flutter locally against local backend.
3. Test admin login + 2FA.
4. Test orders/products/games/settings updates.
5. Deploy backend to Vercel.
6. Point domain to Vercel.
7. Set production env variables.
8. Run production database migration/seed.
9. Test production website.
10. Test Flutter using production API URL.
11. Build Android APK.
12. Keep KHPay in simulation until real webhook test passes.
13. Switch KHPay production mode only after verification.

---

## 15. Known limitations

- Flutter CLI was not available in the build container, so Flutter compilation must be verified on your PC.
- Prisma engine download was blocked in the testing container by DNS, so final `prisma generate` and `next build` must be verified on your PC/server.
- Terms/Privacy editing is not fully database-driven unless you add a `SitePageContent` model later.
- Customer management is still order-based, not full user-account based.
- Real push notifications are not included yet; current notifications are in-app polling.

---

## 16. Final commands summary

Backend local:

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Backend production build:

```bash
npm install
npx prisma generate
npm run build
npm run start
```

Flutter local Android emulator:

```bash
cd jasmin_dashboard
flutter create --platforms=android,ios --project-name jasmin_dashboard .
flutter pub get
flutter run --dart-define=JASMIN_API_BASE_URL=http://10.0.2.2:3000
```

Flutter production APK:

```bash
cd jasmin_dashboard
flutter clean
flutter pub get
flutter analyze
flutter build apk --release --dart-define=JASMIN_API_BASE_URL=https://www.jasmintopup.site
```
