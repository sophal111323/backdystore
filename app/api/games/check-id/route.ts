import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getGameLookupConfig,
  lookupBay2GameNickname,
} from "@/lib/gameLookup/bay2game";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHECK_ID_RATE_LIMIT_WINDOW_MS = 60_000;
const CHECK_ID_RATE_LIMIT_MAX = 5;

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const checkIdRateLimitStore = new Map<string, RateLimitRecord>();

function getClientIp(req: NextRequest): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  const realIp = req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (cfIp) return cfIp;
  if (realIp) return realIp;
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return "unknown";
}

function checkIdRateLimit(ip: string) {
  const now = Date.now();
  const key = `games-check-id:${ip}`;
  const record = checkIdRateLimitStore.get(key);

  if (!record || record.resetAt <= now) {
    checkIdRateLimitStore.set(key, {
      count: 1,
      resetAt: now + CHECK_ID_RATE_LIMIT_WINDOW_MS,
    });

    return {
      allowed: true,
      remaining: CHECK_ID_RATE_LIMIT_MAX - 1,
      retryAfter: 0,
    };
  }

  if (record.count >= CHECK_ID_RATE_LIMIT_MAX) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  checkIdRateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: CHECK_ID_RATE_LIMIT_MAX - record.count,
    retryAfter: 0,
  };
}

const schema = z.object({
  slug: z.string().trim().min(1).max(60),
  uid: z.string().trim().min(1).max(30),
  serverId: z.string().trim().max(20).optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkIdRateLimit(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests",
        message: "You can check ID only 5 times per minute.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
          "X-RateLimit-Limit": String(CHECK_ID_RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const rateLimitHeaders = {
    "X-RateLimit-Limit": String(CHECK_ID_RATE_LIMIT_MAX),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
  };

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      {
        status: 400,
        headers: rateLimitHeaders,
      },
    );
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      },
      {
        status: 400,
        headers: rateLimitHeaders,
      },
    );
  }

  const { slug, uid, serverId } = parsed.data;
  const cfg = getGameLookupConfig(slug);

  if (!cfg) {
    return NextResponse.json(
      {
        success: false,
        error: "Unsupported game",
      },
      {
        status: 400,
        headers: rateLimitHeaders,
      },
    );
  }

  if (cfg.needsServer && !serverId?.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "Server ID is required",
      },
      {
        status: 400,
        headers: rateLimitHeaders,
      },
    );
  }

  const lookupResult = await lookupBay2GameNickname(
    slug,
    uid.trim(),
    cfg.needsServer ? serverId?.trim() : undefined,
  );

  if (!lookupResult.success || !lookupResult.username) {
    const isClientError =
      lookupResult.error === "Player not found — check your ID" ||
      lookupResult.error === "Not supported in this region";
    const status = isClientError ? 404 : 400;

    return NextResponse.json(
      {
        success: false,
        error: lookupResult.error || "Player not found — check your ID",
      },
      {
        status,
        headers: rateLimitHeaders,
      },
    );
  }

  return NextResponse.json(
    {
      success: true,
      name: lookupResult.username,
      uid,
      serverId: serverId ?? null,
      ...(lookupResult.region ? { region: lookupResult.region } : {}),
      ...(lookupResult.game ? { game: lookupResult.game } : {}),
    },
    {
      headers: rateLimitHeaders,
    },
  );
}
