import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitRecord>();

function getClientIp(req: NextRequest): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  const realIp = req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (cfIp) return cfIp;
  if (realIp) return realIp;
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = `fake-admin:${ip}`;
  const record = rateLimitStore.get(key);

  if (!record || record.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });

    return true;
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }

  record.count += 1;
  rateLimitStore.set(key, record);

  return true;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many attempts" },
      { status: 429 }
    );
  }

  let body: unknown = null;

  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const userAgent = req.headers.get("user-agent") || "unknown";
  const referer = req.headers.get("referer") || "unknown";

  console.warn("[SECURITY] Fake admin login attempt", {
    ip,
    userAgent,
    referer,
    body,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}