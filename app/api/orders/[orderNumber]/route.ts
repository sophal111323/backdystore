import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/secureLogger";
import { NextRequest } from "next/server";
import { fetchPaymentStatus } from "@/lib/payment";
import {
  isRemotePaid,
  logPaymentValidationFailure,
  validatePaymentForOrder,
} from "@/lib/payment-validation";
import { API_NO_STORE, publicRateLimit, safeJson } from "@/lib/apiSecurity";
import { refreshTopupStatus } from "@/lib/fulfillment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const lastTopupSyncMap = new Map<string, number>();

/**
 * Public order lookup.
 *
 * Returns both nested fields (backward-compat) and flat frontend-friendly
 * fields so checkout/[orderNumber]/page.tsx can destructure directly.
 *
 * Security rules:
 *  - paymentRef is ONLY returned for SIM- prefixed orders (dev simulation).
 *  - qrString / paymentUrl are only returned when order is PENDING & not expired.
 *  - Customer data is masked.
 *  - No internal IDs, admin notes, webhook data, or failure reasons are exposed.
 */
function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return email.slice(0, 3) + "***";
  return local.slice(0, 2) + "***@" + domain;
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length <= 4) return "****";
  return phone.slice(0, 3) + "****" + phone.slice(-2);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  const normalizedOrderNumber = orderNumber.trim().toUpperCase();

  const limited = publicRateLimit(req, `api-order-detail:${normalizedOrderNumber}`, {
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (!/^[A-Z0-9-]{3,40}$/.test(normalizedOrderNumber)) {
    return safeJson({ error: "Order not found" }, { status: 404 }, API_NO_STORE);
  }

  let order = await prisma.order.findUnique({
    where: { orderNumber: normalizedOrderNumber },
    include: {
      game:    { select: { name: true, slug: true } },
      product: { select: { name: true } },
    },
  });

  if (!order) {
    return safeJson({ error: "Order not found" }, { status: 404 }, API_NO_STORE);
  }

  // 🚀 Auto-sync: If order is PROCESSING with a topupProviderRef, check supplier
  // so the website automatically transitions to DELIVERED when diamonds are sent.
  if (order.status === "PROCESSING" && order.topupProviderRef) {
    const now = Date.now();
    const lastSync = lastTopupSyncMap.get(normalizedOrderNumber) || 0;
    if (now - lastSync >= 5000) {
      lastTopupSyncMap.set(normalizedOrderNumber, now);
      if (lastTopupSyncMap.size > 200) {
        lastTopupSyncMap.clear();
      }

      try {
        const refreshed = await refreshTopupStatus(order.orderNumber);
        if (
          refreshed.success &&
          (refreshed.status === "success" || refreshed.status === "completed")
        ) {
          const fresh = await prisma.order.findUnique({
            where: { orderNumber: normalizedOrderNumber },
            include: {
              game: { select: { name: true, slug: true } },
              product: { select: { name: true } },
            },
          });
          if (fresh) order = fresh;
        }
      } catch (err) {
        console.warn("[api/orders/[orderNumber]] Auto topup sync error:", err);
      }
    }
  }

  // Public order lookup is read-only in production.
  // Development-only sync is opt-in and still requires strict payment validation.
  const allowPublicPaymentSync =
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_PUBLIC_PAYMENT_SYNC === "true";

  if (
    allowPublicPaymentSync &&
    order.status === "PENDING" &&
    order.paymentRef &&
    !order.paymentRef.startsWith("SIM-")
  ) {
    try {
      const remote = await fetchPaymentStatus(order.paymentRef);

      if (isRemotePaid(remote)) {
        const validation = validatePaymentForOrder(order, {
          orderNumber: order.orderNumber,
          transactionId: remote?.transactionId ?? order.paymentRef,
          amount: remote?.amount,
          currency: remote?.currency,
          status: remote?.status,
          paid: remote?.paid,
        });

        if (validation.ok) {
          order = await prisma.order.update({
            where: { id: order.id },
            data: { status: "PAID", paidAt: new Date() },
            include: {
              game: { select: { name: true, slug: true } },
              product: { select: { name: true } },
            },
          });
        } else {
          logPaymentValidationFailure("public_sync", validation);
        }
      }
    } catch (error) {
      logSecurityEvent({
        event: "payment_public_sync_blocked",
        detail: error instanceof Error ? error.message : "public sync failed",
      });
    }
  }

  // Determine if payment info is safe to expose
  const isPending    = order.status === "PENDING";
  const paymentExpiry = order.paymentExpiresAt;
  const isExpired    = paymentExpiry ? paymentExpiry < new Date() : false;
  const canPay       = isPending && !isExpired;

  // Only expose paymentRef for simulation orders (SIM- prefix) in dev.
  // Real payment references are never sent to the client.
  const isSimulation = order.paymentRef?.startsWith("SIM-") ?? false;
  const safePaymentRef =
    canPay && isSimulation && process.env.NODE_ENV !== "production"
      ? order.paymentRef
      : null;

  const qrString   = canPay ? order.qrString   : null;
  const paymentUrl = canPay ? order.paymentUrl  : null;

  return safeJson({
    // ── Core fields ────────────────────────────────────────────────────────
    orderNumber:   order.orderNumber,
    status:        order.status,
    playerUid:     order.playerUid,
    serverId:      order.serverId,
    amountUsd:     order.amountUsd,
    amountKhr:     order.amountKhr,
    paymentMethod: order.paymentMethod,
    createdAt:     order.createdAt.toISOString(),
    paidAt:        order.paidAt?.toISOString()       ?? null,
    deliveredAt:   order.deliveredAt?.toISOString()  ?? null,

    // ── Frontend-friendly flat fields (Task 2) ─────────────────────────────
    gameName:          order.game.name,
    gameSlug:          order.game.slug,
    productName:       order.product.name,
    qrString,
    paymentUrl,
    paymentRef:        safePaymentRef,   // null for real orders; SIM- only in dev
    paymentExpiresAt:  order.paymentExpiresAt?.toISOString() ?? null,

    // ── Masked customer data ───────────────────────────────────────────────
    customerEmail: maskEmail(order.customerEmail),
    customerPhone: maskPhone(order.customerPhone),

    // ── Nested payment object (backward-compat) ────────────────────────────
    payment: {
      canPay,
      paymentUrl,
      qrString,
      expiresAt: order.paymentExpiresAt?.toISOString() ?? null,
    },

    // ── Backward-compat legacy field aliases ───────────────────────────────
    game:    order.game.name,
    package: order.product.name,
    expiresAt: order.paymentExpiresAt?.toISOString() ?? null,

    // NEVER returned: raw paymentRef for real orders, internal transaction ID,
    // webhook data, admin notes, failureReason, or un-masked customer data.
  }, undefined, API_NO_STORE);
}