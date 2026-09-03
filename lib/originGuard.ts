// lib/originGuard.ts
//
// Strict Origin / cross-site guard for API routes (Edge-safe — no Node APIs,
// no new dependencies). Used by middleware.ts for every /api/* request that
// is not exempted (webhooks/cron/internal endpoints authenticate via HMAC
// signatures or shared secrets instead of browser origins).
//
// Rules:
//  1. Origin header present → the request must be:
//       - same-host (the normal same-origin website flow), OR
//       - in the env allowlist (API_ALLOWED_ORIGINS, PUBLIC_APP_URL,
//         NEXT_PUBLIC_BASE_URL — full origins like https://dytopup.site), OR
//       - a localhost origin when NODE_ENV !== "production".
//     Everything else is rejected (403 at the middleware call site).
//  2. Origin header absent → allowed (native apps such as Flutter, curl,
//     monitoring probes and server-to-server calls send no Origin), UNLESS
//     Sec-Fetch-Site: cross-site marks it as cross-site BROWSER abuse
//     (fetch()/XHR/iframe/img from a foreign page).
//
// This is intentionally NOT CORS response headers: the public API is
// same-origin by design, so no Access-Control-Allow-* headers are emitted —
// foreign origins are simply refused.

import type { NextRequest } from "next/server";

export type OriginGuardResult =
  | { ok: true }
  | { ok: false; reason: "origin_not_allowed" | "cross_site_blocked" };

function cleanList(raw: string | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((entry) => entry.trim().replace(/\/+$/, "").toLowerCase())
    .filter(Boolean);
}

/** Full origins (scheme://host[:port]) allowed to call the API from browsers. */
function collectAllowedOrigins(): Set<string> {
  const allowed = new Set<string>();
  const sources = [
    process.env.API_ALLOWED_ORIGINS,
    process.env.PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
  ];

  for (const source of sources) {
    for (const origin of cleanList(source)) {
      if (/^https?:\/\//.test(origin)) {
        allowed.add(origin);
      }
    }
  }

  return allowed;
}

/** Strip a trailing :port while keeping IPv6 bracket syntax intact. */
function hostWithoutPort(host: string): string {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(0, end + 1);
  }

  const idx = host.lastIndexOf(":");
  if (idx === -1) return host;

  const maybePort = host.slice(idx + 1);
  return /^\d+$/.test(maybePort) ? host.slice(0, idx) : host;
}

function isLocalHostname(hostname: string): boolean {
  const bare = hostWithoutPort(hostname);
  return bare === "localhost" || bare === "127.0.0.1" || bare === "[::1]";
}

/**
 * Check whether a request to /api/* is allowed to proceed.
 * See the header comment for the exact rules.
 */
export function isOriginAllowedForApi(req: NextRequest): OriginGuardResult {
  const origin = (req.headers.get("origin") || "").trim().toLowerCase();
  const host = (req.headers.get("host") || "").trim().toLowerCase();
  const isProduction = process.env.NODE_ENV === "production";

  if (origin) {
    // Sandboxed iframe / opaque origin — never legitimate for this API.
    if (origin === "null") {
      return { ok: false, reason: "origin_not_allowed" };
    }

    let originHost = "";
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return { ok: false, reason: "origin_not_allowed" };
    }

    // Same-host requests (the normal same-origin website flow).
    if (host && originHost === host) {
      return { ok: true };
    }

    // Explicitly allowlisted origins (extra frontends, Flutter web admin…).
    if (collectAllowedOrigins().has(origin)) {
      return { ok: true };
    }

    // Local development convenience only — never in production.
    if (!isProduction && isLocalHostname(originHost)) {
      return { ok: true };
    }

    return { ok: false, reason: "origin_not_allowed" };
  }

  // No Origin header: only block obvious cross-site BROWSER traffic.
  // Native apps (Flutter), curl, uptime monitors and internal/cron calls
  // send neither Origin nor Sec-Fetch-Site and must keep working.
  const secFetchSite = (req.headers.get("sec-fetch-site") || "")
    .trim()
    .toLowerCase();

  if (secFetchSite === "cross-site") {
    // Top-level navigations must keep working: users legitimately open API
    // links (invoice PDF downloads) from other sites (e.g. Telegram chats)
    // and gateways redirect browsers back to us. Only block cross-site
    // BROWSER SUBRESOURCE abuse (fetch/XHR/iframe/img/script). Note that
    // state-changing POSTs always carry an Origin header (handled above),
    // even for form-induced navigations, so this carve-out cannot enable
    // CSRF on mutating endpoints.
    const secFetchMode = (req.headers.get("sec-fetch-mode") || "")
      .trim()
      .toLowerCase();

    if (secFetchMode !== "navigate") {
      return { ok: false, reason: "cross_site_blocked" };
    }
  }

  return { ok: true };
}
