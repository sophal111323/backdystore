import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isPaymentSimulationAllowed } from "@/lib/payment";

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute
const RATE_LIMIT_BLOCK_MS = 5 * 60_000; // 5 minutes block

type RateLimitRecord = {
  count: number;
  resetAt: number;
  blockedUntil?: number;
};

const rateLimitStore = new Map<string, RateLimitRecord>();

function getClientIp(req: NextRequest) {
  const cfIp = req.headers.get("cf-connecting-ip");
  const realIp = req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (cfIp) return cfIp;
  if (realIp) return realIp;
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return "unknown";
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const key = `payment-simulate:${ip}`;
  const record = rateLimitStore.get(key);

  // If IP is already blocked
  if (record?.blockedUntil && record.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
    };
  }

  // First request or window expired
  if (!record || record.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      retryAfter: 0,
    };
  }

  // If already reached 10 requests, block for 5 minutes
  if (record.count >= RATE_LIMIT_MAX) {
    const blockedUntil = now + RATE_LIMIT_BLOCK_MS;

    rateLimitStore.set(key, {
      ...record,
      blockedUntil,
    });

    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(RATE_LIMIT_BLOCK_MS / 1000),
    };
  }

  // Allow request and increase count
  record.count += 1;
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - record.count,
    retryAfter: 0,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Simulation: pretends payment succeeded and marks order PAID, then DELIVERED.
// Only active when PAYMENT_SIMULATION_MODE=true in non-production environments.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests",
        message: "This IP is blocked for 5 minutes.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const orderNumber = req.nextUrl.searchParams.get("order");
  const ref = req.nextUrl.searchParams.get("ref");

  if (!orderNumber) {
    return NextResponse.json(
      { error: "Missing order" },
      {
        status: 400,
        headers: {
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    );
  }

  try {
    if (!isPaymentSimulationAllowed()) {
      return NextResponse.json(
        { error: "Payment simulation is disabled" },
        {
          status: 403,
          headers: {
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
          },
        }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Payment configuration error" },
      {
        status: 500,
        headers: {
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    );
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Order not found" },
      {
        status: 404,
        headers: {
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    );
  }

  if (!ref || order.paymentRef !== ref || !ref.startsWith("SIM-")) {
    return NextResponse.json(
      { error: "Invalid simulation reference" },
      {
        status: 403,
        headers: {
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    );
  }

  // Mark as paid
  if (order.status === "PENDING") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentRef: ref,
        paidAt: new Date(),
      },
    });

    // In real life you'd trigger fulfillment here using a queue job.
    // For simulation, mark DELIVERED right away:
    setTimeout(async () => {
      try {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "DELIVERED",
            deliveredAt: new Date(),
          },
        });
      } catch (error) {
        console.error("Simulation delivery update failed:", error);
      }
    }, 100);
  }

  const baseUrl = (
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  ).replace(/\/+$/, "");

  const safeOrderNumberForUrl = encodeURIComponent(orderNumber);
  const safeOrderNumberForHtml = escapeHtml(orderNumber);

  const html = `<!doctype html>
<html>
<head>
<title>Payment Simulated — DYTOPUP</title>
<meta http-equiv="refresh" content="3;url=${baseUrl}/order?number=${safeOrderNumberForUrl}">
<style>
  body {
    font-family: system-ui;
    background: #0A0A0F;
    color: #F5F5F7;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
  }

  .box {
    text-align: center;
    padding: 2rem;
    border: 1px solid #24243A;
    border-radius: 16px;
    background: #12121A;
    max-width: 400px;
  }

  h1 {
    color: #FF6B1A;
    margin: 0 0 1rem;
  }

  .check {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  code {
    background: #24243A;
    padding: 2px 8px;
    border-radius: 4px;
    color: #FFB800;
  }

  a {
    color: #FF6B1A;
  }
</style>
</head>
<body>
  <div class="box">
    <div class="check">✅</div>
    <h1>Payment Simulated</h1>
    <p>Order <code>${safeOrderNumberForHtml}</code> is being processed.</p>
    <p style="color:#8B8B9E;font-size:0.875rem">
      Simulation mode is active — in production this would be your real Tola Saint payment confirmation.
    </p>
    <p>Redirecting to order tracker in 3s...</p>
    <p>
      <a href="${baseUrl}/order?number=${safeOrderNumberForUrl}">
        Continue now →
      </a>
    </p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
      "X-RateLimit-Remaining": String(rateLimit.remaining),
    },
  });
}