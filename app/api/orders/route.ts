import { prisma } from "@/lib/prisma";
import { generateOrderNumber, isValidUid, calcKhr } from "@/lib/utils";
import { initiatePayment } from "@/lib/payment";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getIp";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Parse a positive integer env var with clamped bounds and a safe default. */
function envInt(
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = (process.env[name] || "").trim();
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
}

// Order-creation rate limit (Issue #4) — env-tunable, defaults unchanged:
// 10 orders per IP per 10 minutes. Hard bounds prevent foot-guns
// (e.g. unlimited orders or a sub-second window).
const ORDER_RATE_LIMIT_MAX = envInt("ORDER_RATE_LIMIT_MAX", 10, 1, 1000);
const ORDER_RATE_LIMIT_WINDOW_MS = envInt(
  "ORDER_RATE_LIMIT_WINDOW_MS",
  10 * 60 * 1000,
  1_000,
  24 * 60 * 60 * 1000
);

const createOrderSchema = z.object({
  gameId: z.string().min(1),
  productId: z.string().min(1),
  playerUid: z.string().min(4).max(20),
  serverId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  paymentMethod: z.enum(["TOLASAINT", "ABA", "ACLEDA", "WING"]),
  promoCode: z.string().optional(),
  playerNickname: z.string().max(100).optional(),
  turnstileToken: z.string().min(1),
});

export async function POST(req: NextRequest) {

  // ── Rate limit: tunable per-IP order creation limit (Issue #4) ─────────
  // Defaults preserve the historical 10 orders / 10 minutes / IP.
  // Full guest-checkout auth stack for POST /api/orders (no user accounts
  // by design — orders are placed as guests):
  //   1. middleware origin guard (browser callers must be same-origin or
  //      explicitly allowlisted via API_ALLOWED_ORIGINS),
  //   2. Cloudflare Turnstile (verifyTurnstileToken below),
  //   3. this DB-backed per-IP rate limit (survives restarts & multi-instance),
  //   4. zod validation + banlist checks.
  // Admin order access uses GET /api/orders (withAdminAuth).
  const ip = getClientIp(req);
  const rl = await applyRateLimit(
    `orders:${ip}`,
    ORDER_RATE_LIMIT_MAX,
    ORDER_RATE_LIMIT_WINDOW_MS,
    ip
  );
  if (rl) return rl;

  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // 🛡️ Cloudflare Turnstile Bot Validation:
    // Verify token BEFORE executing any database queries or external banking API calls
    const isBotChallengePassed = await verifyTurnstileToken({
      req,
      token: data.turnstileToken,
      kind: "public",
      expectedAction: "create_order",
    });

    if (!isBotChallengePassed) {
      return NextResponse.json(
        {
          error: "ការផ្ទៀងផ្ទាត់សុវត្ថិភាពមិនជោគជ័យ (Bot verification failed). សូម refresh ទំព័រ រួចសាកល្បងម្ដងទៀត។",
        },
        { status: 403 }
      );
    }

    if (!isValidUid(data.playerUid)) {
      return NextResponse.json({ error: "Invalid UID format" }, { status: 400 });
    }

    // Maintenance mode blocks new orders site-wide.
    const maintSettings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (maintSettings?.maintenanceMode) {
      return NextResponse.json(
        { error: maintSettings.maintenanceMessage || "Ordering is temporarily disabled for maintenance." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (maintSettings?.ordersEnabled === false) {
      return NextResponse.json(
        { error: "Orders are temporarily disabled." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (maintSettings?.paymentsEnabled === false) {
      return NextResponse.json(
        { error: "Payments are temporarily disabled." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Banlist: block orders from flagged emails, phones, IPs or UIDs.
    const ipAddress = getClientIp(req);
    const banCandidates = [
      { type: "email", value: data.customerEmail?.toLowerCase() },
      { type: "phone", value: data.customerPhone?.toLowerCase() },
      { type: "ip", value: ipAddress.toLowerCase() },
      { type: "uid", value: data.playerUid.toLowerCase() },
    ].filter((c): c is { type: string; value: string } => !!c.value);

    if (banCandidates.length > 0) {
      const blocked = await prisma.blockedIdentity.findFirst({
        where: { OR: banCandidates.map((c) => ({ type: c.type, value: c.value })) },
      });
      if (blocked) {
        return NextResponse.json(
          { error: "This order cannot be processed. Contact support if you believe this is a mistake." },
          { status: 403 }
        );
      }
    }

    // Validate game + product match and pricing
    const [game, product, settings] = await Promise.all([
      prisma.game.findUnique({ where: { id: data.gameId } }),
      prisma.product.findUnique({ where: { id: data.productId } }),
      prisma.settings.findUnique({ where: { id: 1 } }),
    ]);

    if (!game || !game.active) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    if (!product || !product.active || product.gameId !== game.id) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (game.requiresServer && !data.serverId) {
      return NextResponse.json({ error: "Server is required for this game" }, { status: 400 });
    }

    // Create the order
    const orderNumber = generateOrderNumber();
    const userAgent = req.headers.get("user-agent") ?? "unknown";
    const exchangeRate = settings?.exchangeRate ?? 4100;

    // ── Promo code handling (race-condition-safe) ────────────────────────────
    //
    // OLD (buggy): read usedCount → check < maxUses → increment
    //   Two concurrent requests can both pass the check before either
    //   increments, letting the same code be used more times than maxUses.
    //
    // FIX: wrap everything in a Prisma transaction and use a conditional
    //   updateMany that includes the `usedCount < maxUses` guard inside the
    //   WHERE clause.  The database evaluates the check and the increment
    //   atomically, so only one winner gets through when the last slot is used.
    type PromoApplied = {
      promoCodeId: string;
      discountUsd: number;
      finalPrice: number;
    };

    let promoCodeId: string | null = null;
    let discountUsd = 0;
    let finalPrice = product.priceUsd;

    if (data.promoCode && settings?.promosEnabled === false) {
      return NextResponse.json(
        { error: "Promo codes are temporarily disabled." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (data.promoCode) {
      const promoApplied = await prisma.$transaction(
        async (tx): Promise<PromoApplied | null> => {
          // 1. Fetch the promo inside the transaction for a consistent read.
          const promo = await tx.promoCode.findUnique({
            where: { code: data.promoCode!.toUpperCase().trim() },
          });

          // Basic eligibility checks (non-atomic — just early-exit guards).
          if (!promo || !promo.active) return null;
          if (promo.expiresAt && promo.expiresAt < new Date()) return null;
          if (product.priceUsd < promo.minOrderUsd) return null;

          // 2. Atomic conditional increment — WHERE includes the maxUses guard.
          //    If another request just used the last slot, updateMany returns
          //    count=0 and we bail out cleanly without double-spending.
          const updated = await tx.promoCode.updateMany({
            where: {
              id: promo.id,
              active: true,
              OR: [
                { maxUses: { equals: 0 } },          // unlimited code
                { usedCount: { lt: promo.maxUses } }, // still has slots
              ],
            },
            data: { usedCount: { increment: 1 } },
          });

          if (updated.count === 0) {
            // Lost the race or limit already reached — treat as invalid.
            return null;
          }

          // 3. Calculate discount only after we have secured the slot.
          let discount =
            promo.discountType === "PERCENT"
              ? (product.priceUsd * promo.discountValue) / 100
              : promo.discountValue;
          discount = Math.min(discount, product.priceUsd);
          discount = Math.round(discount * 100) / 100;

          return {
            promoCodeId: promo.id,
            discountUsd: discount,
            finalPrice: Math.round((product.priceUsd - discount) * 100) / 100,
          };
        }
      );

      if (promoApplied) {
        promoCodeId = promoApplied.promoCodeId;
        discountUsd = promoApplied.discountUsd;
        finalPrice  = promoApplied.finalPrice;
      }
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        gameId: game.id,
        productId: product.id,
        playerUid: data.playerUid,
        serverId: data.serverId,
        playerNickname: data.playerNickname,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        amountUsd: finalPrice,
        amountKhr: calcKhr(finalPrice, exchangeRate),
        paymentMethod: data.paymentMethod,
        status: "PENDING",
        ipAddress,
        userAgent,
        promoCodeId,
        discountUsd,
      },
    });

    // Initiate payment with the gateway
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/+$/, "");
    // Prefer PUBLIC_APP_URL (tunnel/production domain) for gateway callbacks
    // so webhooks actually reach us. Falls back to baseUrl; the payment lib
    // strips localhost URLs automatically (the gateway refuses private IPs).
    const publicUrl = (process.env.PUBLIC_APP_URL || baseUrl).replace(/\/+$/, "");
    const init = await initiatePayment({
      orderNumber: order.orderNumber,
      amountUsd: order.amountUsd,
      currency: order.currency,
      method: data.paymentMethod as any,
      returnUrl: `${publicUrl}/order?number=${order.orderNumber}`,
      cancelUrl: `${publicUrl}/games/${game.slug}`,
      callbackUrl: `${publicUrl}/api/payment/webhook/tolasaint`,
      note: `DYTOPUP · ${game.name} · ${product.name}`,
      customerEmail: data.customerEmail,
      metadata: {
        game_slug: game.slug,
        product_name: product.name,
        player_uid: data.playerUid,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentRef: init.paymentRef,
        paymentUrl: init.redirectUrl,
        qrString: init.qrString ?? null,
        paymentExpiresAt: init.expiresAt,
      },
    });

    return NextResponse.json({
      orderNumber: order.orderNumber,
      redirectUrl: `${baseUrl}/checkout/${order.orderNumber}`,
    });
  } catch (err) {
    console.error("Order create error:", err);
    // Security: never expose internal error messages to public users
    return NextResponse.json(
      { error: "Something went wrong. Please try again or contact support." },
      { status: 500 }
    );
  }
}

/**
 * Admin-only order list. The public site/app never lists all orders — they
 * track a single order via GET /api/orders/[orderNumber]. Without a valid admin
 * session this returns 401 (JSON); without the orders.read permission, 403.
 * Returns an explicit safe-field allowlist (no ipAddress, userAgent, customer
 * PII, adminNote, cost/profit, or secrets).
 */
export const GET = withAdminAuth(
  async () => {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        orderNumber: true,
        status: true,
        amountUsd: true,
        amountKhr: true,
        currency: true,
        paymentMethod: true,
        createdAt: true,
        paidAt: true,
        deliveredAt: true,
        game: { select: { name: true, slug: true } },
        product: { select: { name: true } },
      },
    });
    return NextResponse.json(orders, { headers: { "Cache-Control": "no-store" } });
  },
  { permission: "orders.read" }
);
