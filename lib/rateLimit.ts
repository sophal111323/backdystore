import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/secureLogger";

const memStore = new Map<string, number[]>();

export function checkRateLimitMemory(
  key: string,
  max: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  let timestamps = (memStore.get(key) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= max) {
    memStore.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  memStore.set(key, timestamps);
  return true;
}

export async function checkRateLimitDb(
  key: string,
  max: number,
  windowMs: number,
  ip?: string
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  try {
    const count = await prisma.rateLimitEntry.count({
      where: {
        key,
        createdAt: { gte: windowStart },
      },
    });

    if (count >= max) {
      logSecurityEvent({
        event: "rate_limit_exceeded",
        detail: key,
        ip,
        count,
        max,
      });
      prisma.rateLimitEntry
        .deleteMany({ where: { key, createdAt: { lt: windowStart } } })
        .catch(() => {});
      return false;
    }

    await prisma.rateLimitEntry.create({ data: { key, ip: ip ?? null } });

    prisma.rateLimitEntry
      .deleteMany({ where: { key, createdAt: { lt: windowStart } } })
      .catch(() => {});

    return true;
  } catch (err) {
    // ✅ Fail-closed: block request ពេល DB មិន available
    // មិន fallback ទៅ memory ទេ — ការពារ bypass after server restart
    console.error("[rateLimit] DB error, blocking as precaution:", err);
    logSecurityEvent({
      event: "rate_limit_exceeded",
      detail: `DB unavailable for key: ${key} — blocking as precaution`,
      ip,
    });
    return false;
  }
}

export async function applyRateLimit(
  key: string,
  max: number,
  windowMs: number,
  ip?: string
): Promise<Response | null> {
  const allowed = await checkRateLimitDb(key, max, windowMs, ip);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(windowMs / 1000)),
          "Cache-Control": "no-store",
        },
      }
    );
  }
  return null;
}