<div align="center">

<br />

```
  ██████╗  ██╗   ██╗ ████████╗  ██████╗  ██████╗  ██╗   ██╗ ██████╗ 
  ██╔══██╗ ╚██╗ ██╔╝ ╚══██╔══╝ ██╔═══██╗ ██╔══██╗ ██║   ██║ ██╔══██╗
  ██║  ██║  ╚████╔╝     ██║    ██║   ██║ ██████╔╝ ██║   ██║ ██████╔╝
  ██║  ██║   ╚██╔╝      ██║    ██║   ██║ ██╔═══╝  ██║   ██║ ██╔═══╝ 
  ██████╔╝    ██║       ██║    ╚██████╔╝ ██║      ╚██████╔╝ ██║     
  ╚═════╝     ╚═╝       ╚═╝     ╚═════╝  ╚═╝       ╚═════╝  ╚═╝     
```

### ⚡ Premium Instant Game Top-Up Platform for Cambodia 🇰🇭

*Fast, secure, automated game currency delivery powered by KHQR payments & Next.js 15.*

<br />

[![Next.js](https://img.shields.io/badge/Next.js-15.1-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.0-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)

<br />

[![Developer](https://img.shields.io/badge/Developer-SokPhal-e91e8c?style=flat-square&logo=visual-studio-code&logoColor=white)](https://sophal.vercel.app/)
[![Telegram Support](https://img.shields.io/badge/Telegram-@dytopup-24A1DE?style=flat-square&logo=telegram&logoColor=white)](https://t.me/dytopup)
[![License](https://img.shields.io/badge/License-Proprietary-pink?style=flat-square)](#-license--copyright)

<br />

[✨ Core Features](#-core-features) • [⚡ 5-Min Quickstart](#-5-minute-quickstart) • [🛠️ Admin Control](#️-admin-control-center) • [🔐 Security Architecture](#-security-architecture) • [🚀 Deployment](#-deployment-guide) • [📄 License](#-license--copyright)

</div>

<br />

---

## 🎯 Overview

**DyTopup** is a modern, high-concurrency top-up ecosystem tailored for Cambodian gamers and digital merchants. Customers purchase in-game currencies (Mobile Legends Diamonds, Free Fire Diamonds, PUBG Mobile UC, Roblox Robux, and more) using dynamic **KHQR (Bakong / ABA / ACLEDA)** with real-time automated delivery dispatched straight to upstream providers (**Khmer TopUp** & **Bay2Game**).

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Customer UI   │ ────► │  DyTopup Engine │ ────► │   KHQR Gateway  │
│  (Next.js App)  │       │ (Prisma + Neon) │       │ (Tola Saint/ABA)│
└─────────────────┘       └────────┬────────┘       └─────────────────┘
                                   │
                                   ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Telegram Alert │ ◄──── │ Top-up Supplier │ ◄──── │ Automated Order │
│ (1-Msg Summary) │       │ (Khmer TopUp)   │       │   Fulfillment   │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## ✨ Core Features

<table width="100%">
<tr>
<td width="50%" valign="top">

### 🛍️ Customer Experience
- 🎮 **Game Catalog:** Dynamic grid with custom badges (Hot, Best, Pass).
- 🆔 **Real-Time Validation:** Automatic Player UID & server verification.
- 💱 **Currency Switcher:** Seamless live toggle between USD ($) and KHR (៛).
- 🔍 **Live Order Tracking:** 3-second polling with animated status timelines.
- 🧾 **PDF Invoices:** Server-rendered branded invoices generated with `pdfkit`.
- 📱 **Mobile Spring Animations:** Fluid iOS-style drawer navigation.

</td>
<td width="50%" valign="top">

### 🛡️ Admin Command Center
- 🔐 **Obfuscated Login:** Stealth access route with progressive lockout.
- 📦 **Catalog Management:** Reorderable games, packages & banners.
- 📊 **Revenue Analytics:** Daily charts, transaction volume & top games.
- 🚫 **Security Banlist:** Instant IP, UID, Phone, and Email blacklist.
- 📜 **Tamper-Proof Audit:** Structured log tracking every administrative action.
- 📱 **Flutter Companion:** Native Android/iOS companion app (`dytopup_dashboard`).

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 💳 Payments & Automation
- 🇰🇭 **Universal KHQR:** Scannable across all 30+ Cambodian banking apps.
- ⏱️ **Dynamic QR Expiry:** Precise 180s countdown with auto-cancellation.
- 🤖 **Auto-Delivery:** Instant dispatch via Khmer TopUp and Bay2Game APIs.
- 🔒 **HMAC Verification:** Webhook signature authentication preventing replay.
- 🧪 **Simulation Mode:** Built-in sandbox mode for zero-cost local testing.

</td>
<td width="50%" valign="top">

### ⚡ Infrastructure & Security
- 🛡️ **Progressive Lockout:** 3 fails = 1 min, 4 fails = 5 min, 5+ = progressive lock.
- 📩 **Unified Telegram Bot:** Clean 1-message alert for payment + topup status.
- 🍪 **SameSite=Strict Cookies:** Bulletproof CSRF & session hijacking defense.
- 🌐 **Content Security Policy:** Nonce-based CSP guarding against XSS.
- 🚀 **Tailwind CSS v4:** Ultra-optimized styling engine with Turbopack.

</td>
</tr>
</table>

---

## ⚡ 5-Minute Quickstart

### 1. Clone Repository & Install Dependencies

```bash
git clone https://github.com/sophal111323/backdystore.git
cd backdystore
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Set your minimum environment keys in `.env`:

```env
# Database (Neon / Supabase Serverless Postgres)
DATABASE_URL="postgresql://user:password@ep-sample.ap-southeast-1.neon.tech/dytopup?sslmode=require"

# Security & Admin Authentication
ADMIN_JWT_SECRET="generate-a-super-secret-32-character-key-here"
ADMIN_EMAIL="admin@dytopup.com"
ADMIN_PASSWORD="YourSecurePassword123!@#"

# Payment Gateway (Tola Saint / Sandbox)
PAYMENT_SIMULATION_MODE="true"
TOLA_SAINT_BASE_URL="https://api.tolasaint.com"
TOLA_SAINT_API_KEY=""
TOLA_SAINT_WEBHOOK_SECRET=""

# Public Application URLs
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Initialize Database & Seed

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 4. Launch Development Server

```bash
npm run dev
```

* 🌐 **Storefront:** [http://localhost:3000](http://localhost:3000)
* 🔒 **Admin Portal:** [http://localhost:3000/admin/dystore](http://localhost:3000/admin/dystore)

---

## 🛠️ Admin Control Center

| Route | Functionality | Access Level |
| :--- | :--- | :---: |
| `/admin` | Main Dashboard & Live Sales Statistics | `Admin` |
| `/admin/games` | Game Management (Add, Edit, Reorder, Badges) | `Admin` |
| `/admin/products` | Top-Up Package Pricing & Supplier Mapping | `Admin` |
| `/admin/orders` | Live Transactions, Status Sync & CSV Export | `Admin` |
| `/admin/banners` | Homepage Hero Slider & Promotions | `Admin` |
| `/admin/customers` | Aggregated Customer Directory & Lifetime Spend | `Admin` |
| `/admin/banlist` | Fraud Prevention & Entity Blacklist (IP/UID) | `SuperAdmin` |
| `/admin/audit-logs` | Immutable Audit Trail of Admin Operations | `SuperAdmin` |
| `/admin/settings` | Branding, Announcement Bar & Maintenance Gate | `SuperAdmin` |

---

## 🔐 Security Architecture

```
                                  ┌───────────────────────────┐
                                  │      Incoming Request     │
                                  └─────────────┬─────────────┘
                                                │
                                                ▼
                                  ┌───────────────────────────┐
                                  │  Edge Security Middleware │
                                  │  (CSP Nonce, Strict Headers)│
                                  └─────────────┬─────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
        ┌─────────────────────────┐                           ┌─────────────────────────┐
        │     Public Endpoints    │                           │     Admin Endpoints     │
        │  • Zod Schema Validator │                           │  • SameSite=Strict Auth │
        │  • IP Rate Limiter      │                           │  • Progressive Lockout  │
        │  • Anti-IDOR Masking    │                           │  • RBAC Permission Gate │
        └─────────────────────────┘                           └─────────────────────────┘
```

- 🛡️ **Progressive Lock Policy:** Brute-force mitigation algorithm (Fails 1-2: 0s, Fail 3: 1 min, Fail 4: 5 min, Fail 5+: 15-30 min).
- 🍪 **Stateless Hybrid Session:** HttpOnly JWT with database `admin.active` revocation verification on every request.
- ⚡ **Anti-SSRF Protection:** Outgoing requests are constrained strictly to predefined supplier hostnames.
- 🛡️ **Upload Hardening:** Magic-byte inspection, file size capping (5MB), and SVG elimination to prevent stored XSS.

---

## 🚀 Deployment Guide

### Deploying to Vercel (Recommended)

1. Push your repository to GitHub (`main` branch).
2. Import the project into **[Vercel Dashboard](https://vercel.com/new)**.
3. Configure Environment Variables (`DATABASE_URL`, `ADMIN_JWT_SECRET`, etc.).
4. Set Build Command to `npm run build` and deploy!
5. In your **Tola Saint Dashboard**, point your Webhook URL to:
   ```
   https://your-domain.vercel.app/api/payment/webhook/tolasaint
   ```

---

## 📂 Project Structure

```
dytopup/
├── app/
│   ├── (storefront)/         # Home, Game details, Order tracker, FAQ, Blog
│   ├── admin/                # Admin Panel UI pages
│   └── api/                  # RESTful API handlers (Orders, Payment, Auth, Admin)
├── components/               # Modular UI Components (Header, Footer, KHQR Sheet)
├── lib/
│   ├── payment/              # Tola Saint KHQR provider & sandbox engine
│   ├── topup/                # Khmer TopUp & Bay2Game fulfillment adapters
│   ├── auth.ts               # Web & Mobile authentication helpers
│   ├── lockPolicy.ts         # Progressive lockout security policy
│   └── telegram.ts           # Unified Telegram bot dispatcher
├── prisma/
│   ├── schema.prisma         # Multi-model database schema
│   └── seed.ts               # Default games & administrator seed script
├── public/                   # Static assets & brand icons
└── scripts/                  # Management scripts & favicon generator
```

---

## 📄 License & Copyright

**Copyright © 2026 DyTopup (SokPhal). All Rights Reserved.**

Developed & Maintained with ❤️ by **[SokPhal](https://sophal.vercel.app/)** for **DyTopup**.

This project and its source code are proprietary and confidential. Unauthorized copying, distribution, reproduction, or modification of this project, in whole or in part, via any medium is strictly prohibited without explicit written permission from the author.

---

<div align="center">

Built with ⚡ for the Cambodian gaming community by **[SokPhal](https://sophal.vercel.app/)**.  
Support: **[@dytopup](https://t.me/dytopup)** on Telegram • Portfolio: **[sophal.vercel.app](https://sophal.vercel.app/)**

</div>

