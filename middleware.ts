import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isOriginAllowedForApi } from "@/lib/originGuard";
import { logSecurityEvent } from "@/lib/secureLogger";

const SESSION_COOKIE = "admin_token";

const ADMIN_HOME_PATH = "/admin";
// Secret login URL — change anytime via ADMIN_LOGIN_PATH in .env, no code needed.
const ADMIN_LOGIN_PATH = process.env.ADMIN_LOGIN_PATH || "/admin/dystore";
// Physical page route — never exposed; secret URLs are rewritten here internally.
const INTERNAL_LOGIN_ROUTE = "/admin/dystore";
const HONEY_PATH = "/admin/login";

// ✅ Valid admin routes — unknown paths will NOT reveal the real login URL
const VALID_ADMIN_PREFIXES = [
  "/admin/audit-logs",
  "/admin/banlist",
  "/admin/banners",
  "/admin/blog",
  "/admin/customers",
  "/admin/faqs",
  "/admin/games",
  "/admin/orders",
  "/admin/products",
  "/admin/promo-codes",
  "/admin/security",
  "/admin/settings",
  "/admin/login",
];

function isValidAdminPath(pathname: string): boolean {
  if (pathname === ADMIN_HOME_PATH) return true;

  return VALID_ADMIN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function isAdminArea(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin")
  );
}

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

async function isValidAdminToken(token?: string) {
  const secret = getSecret();

  if (!token || !secret) {
    return false;
  }

  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();

  const os =
    ua.includes("android") ? "Android" :
    ua.includes("iphone") || ua.includes("ios") ? "iOS" :
    ua.includes("windows") ? "Windows" :
    ua.includes("mac os") ? "macOS" :
    "Unknown";

  const browser =
    ua.includes("edg") ? "Edge" :
    ua.includes("chrome") ? "Chrome" :
    ua.includes("safari") ? "Safari" :
    ua.includes("firefox") ? "Firefox" :
    "Unknown";

  const device =
    ua.includes("mobile") ? "Mobile" :
    ua.includes("tablet") ? "Tablet" :
    "Desktop/Unknown";

  return { os, browser, device };
}

function getRequestIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

function shouldTrackRequest(pathname: string): boolean {
  if (!process.env.INTERNAL_SECURITY_SECRET) return false;

  // Avoid loops and noisy internal/admin-only traffic.
  if (pathname.startsWith("/api/security/track")) return false;
  if (pathname.startsWith("/api/cron")) return false;
  if (pathname.startsWith("/api/admin")) return false;
  if (pathname.startsWith("/admin")) return false;

  return true;
}

// ── API origin guard exemptions ──────────────────────────────────────────
// These endpoints authenticate via HMAC signatures or shared secrets
// (not browser origins), so the origin guard must never apply to them.
const ORIGIN_GUARD_EXEMPT_PREFIXES = [
  "/api/payment/webhook/", // Tola Saint webhook — HMAC-SHA256 signed
  "/api/webhooks/", // FrozenYuki webhook — HMAC-SHA256 signed
  "/api/cron/", // Vercel cron — CRON_SECRET gated
  "/api/security/track", // middleware's own internal fetch — INTERNAL_SECURITY_SECRET gated
  "/api/health", // uptime monitors
  "/api/check-ip", // admin-gated diagnostic (Flutter admin calls)
  "/api/public/", // public metadata (app version) — Flutter apps
];

function isOriginGuardExempt(pathname: string): boolean {
  return ORIGIN_GUARD_EXEMPT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p)
  );
}

async function trackRequest(req: NextRequest, pathname: string) {
  try {
    const userAgent = req.headers.get("user-agent") || "";
    const { os, browser, device } = parseUserAgent(userAgent);

    await fetch(new URL("/api/security/track", req.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_SECURITY_SECRET || "",
      },
      body: JSON.stringify({
        ip: getRequestIp(req),
        path: pathname,
        method: req.method,
        country: req.headers.get("cf-ipcountry") || null,
        userAgent,
        os,
        browser,
        device,
        referer: req.headers.get("referer") || null,
      }),
      cache: "no-store",
    });
  } catch {
    // Never break the site if analytics logging fails.
  }
}

function generateNonce(): string {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))
  );
}

function buildCspHeader(nonce: string): string {
  const turnstile = "https://challenges.cloudflare.com";
  const isDev = process.env.NODE_ENV === "development";

  // Strict script-src: nonce-based, conditionally include 'unsafe-eval' ONLY in development
  // for React Fast Refresh / HMR, strictly removed in production.
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval' ${turnstile}`
    : `'self' 'nonce-${nonce}' ${turnstile}`;

  // Strict style-src: nonce-based, no unsafe-eval
  const styleSrc = `'self' 'nonce-${nonce}' https://fonts.googleapis.com`;

  // Specific image sources - no wildcard scheme (no https:)
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https://res.cloudinary.com",
    "https://i.ibb.co",
    "https://api.qrserver.com",
    "https://img.freepik.com",
  ].join(" ");

  // Specific connect sources - allow local dev sockets only in development
  const connectSrc = [
    "'self'",
    isDev ? "http://localhost:* ws://localhost:* wss:" : "",
    turnstile,
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
    "https://res.cloudinary.com",
    "https://api.qrserver.com",
    "https://i.ibb.co",
    "https://img.freepik.com",
    "https://tolasaint.com",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `style-src-elem 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-inline'" : ""} https://fonts.googleapis.com`,
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src ${imgSrc}`,
    `connect-src ${connectSrc}`,
    `frame-src 'self' ${turnstile}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    isDev ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}

function addSecurityHeaders(
  response: NextResponse,
  cspHeader: string,
  nonce: string
): NextResponse {
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("x-nonce", nonce);

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  // Prevent information disclosure (mask Server & strip X-Powered-By)
  response.headers.delete("x-powered-by");
  response.headers.delete("X-Powered-By");
  response.headers.set("Server", "web");

  return response;
}

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  if (shouldTrackRequest(pathname)) {
    event.waitUntil(trackRequest(req, pathname));
  }

  const nonce = generateNonce();
  const cspHeader = buildCspHeader(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  // ✅ API origin guard (Edge-safe): browser calls to /api/* must be
  // same-origin or explicitly allowlisted via API_ALLOWED_ORIGINS /
  // PUBLIC_APP_URL / NEXT_PUBLIC_BASE_URL. Non-browser callers (Flutter
  // apps, curl, uptime monitors) send no Origin header and pass — they are
  // only refused when Sec-Fetch-Site marks them as cross-site browser
  // subresource abuse. Signature/secret-authenticated endpoints are
  // exempt (ORIGIN_GUARD_EXEMPT_PREFIXES above). No CORS response headers
  // are emitted: the public API is same-origin by design.
  if (pathname.startsWith("/api/") && !isOriginGuardExempt(pathname)) {
    const originCheck = isOriginAllowedForApi(req);
    if (!originCheck.ok) {
      logSecurityEvent({
        event: "origin_blocked",
        detail: `path=${pathname}; reason=${originCheck.reason}`,
        ip: getRequestIp(req),
      });

      return addSecurityHeaders(
        new NextResponse(
          JSON.stringify({ error: "Forbidden" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          }
        ),
        cspHeader,
        nonce
      );
    }
  }

  function nextResponse(): NextResponse {
    return addSecurityHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      cspHeader,
      nonce
    );
  }

  function redirectResponse(url: URL): NextResponse {
    return addSecurityHeaders(
      NextResponse.redirect(url),
      cspHeader,
      nonce
    );
  }

  // ✅ Normal pages: only apply CSP/security headers.
  // No need to verify admin JWT outside admin area.
  if (!isAdminArea(pathname)) {
    return nextResponse();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isLoggedIn = await isValidAdminToken(token);

  // Admin API routes validate cookie/Bearer sessions inside route handlers.
  // Middleware only adds security headers here so Flutter Bearer tokens are not blocked.
  if (pathname.startsWith("/api/admin")) {
    return nextResponse();
  }

  // ✅ Secret login URL (from env) — rewritten internally to the real page.
  // Direct visits to the internal route are NOT whitelisted, so they fall
  // through and get redirected to the honeypot instead of revealing anything.
  if (pathname === ADMIN_LOGIN_PATH) {
    if (isLoggedIn) {
      return redirectResponse(new URL(ADMIN_HOME_PATH, req.url));
    }

    return addSecurityHeaders(
      NextResponse.rewrite(new URL(INTERNAL_LOGIN_ROUTE, req.url)),
      cspHeader,
      nonce
    );
  }

  // ✅ Honeypot page
  if (pathname === HONEY_PATH) {
    if (isLoggedIn) {
      return redirectResponse(new URL(ADMIN_HOME_PATH, req.url));
    }

    return nextResponse();
  }

  // ✅ Not logged in + exact /admin → redirect to honeypot
  if (!isLoggedIn && pathname === ADMIN_HOME_PATH) {
    return redirectResponse(new URL(HONEY_PATH, req.url));
  }

  // ✅ Not logged in + protected admin API → 401
  // ✅ Not logged in + valid protected admin page → real login
  if (!isLoggedIn && isValidAdminPath(pathname)) {
    return redirectResponse(new URL(ADMIN_LOGIN_PATH, req.url));
  }

  // ✅ Not logged in + unknown admin path → honeypot, not real login
  if (!isLoggedIn && pathname.startsWith("/admin")) {
    return redirectResponse(new URL(HONEY_PATH, req.url));
  }

  // ✅ Logged in → allow
  return nextResponse();
}

export const config = {
  matcher: [
    /*
      Apply CSP/security headers to normal pages and API routes,
      but skip Next.js static/image assets and common static files.
    */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)$).*)",
  ],
};
