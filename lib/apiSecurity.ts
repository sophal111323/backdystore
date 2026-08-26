import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/getIp";
import { checkRateLimitMemory } from "@/lib/rateLimit";

export const API_CACHE_SHORT = "public, max-age=30, s-maxage=300, stale-while-revalidate=600";
export const API_CACHE_DYNAMIC = "public, max-age=0, s-maxage=10, stale-while-revalidate=30, must-revalidate";
export const API_NO_STORE = "no-store, no-cache, must-revalidate";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  message?: string;
};

export function addApiSecurityHeaders(
  response: NextResponse,
  cacheControl = API_NO_STORE
): NextResponse {
  if (!response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", cacheControl);
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export function safeJson(
  data: unknown,
  init?: ResponseInit,
  cacheControl = API_NO_STORE
): NextResponse {
  return addApiSecurityHeaders(NextResponse.json(data, init), cacheControl);
}

export function publicRateLimit(
  req: NextRequest,
  keyPrefix: string,
  options: RateLimitOptions
): NextResponse | null {
  const ip = getClientIp(req);
  const allowed = checkRateLimitMemory(
    `${keyPrefix}:${ip}`,
    options.limit,
    options.windowMs
  );

  if (allowed) return null;

  const retryAfter = Math.ceil(options.windowMs / 1000);

  return safeJson(
    {
      error: options.message || "Too many requests. Please try again later.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(options.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

export function hasSuspiciousQuery(req: NextRequest): boolean {
  const raw = req.nextUrl.search;

  if (raw.length > 2048) return true;

  return /(?:\.\.|%2e%2e|<|>|%3c|%3e|\u0000|%00)/i.test(raw);
}

export function rejectSuspiciousQuery(req: NextRequest): NextResponse | null {
  if (!hasSuspiciousQuery(req)) return null;

  return safeJson({ error: "Bad request" }, { status: 400 });
}
