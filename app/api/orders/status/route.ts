import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  API_NO_STORE,
  publicRateLimit,
  rejectSuspiciousQuery,
  safeJson,
} from "@/lib/apiSecurity";
import { refreshTopupStatus } from "@/lib/fulfillment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Prevent slamming supplier status check if user polls rapidly (throttle 5s per order)
const lastTopupSyncMap = new Map<string, number>();

function normalizeOrderNumber(value: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

function maskValue(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export async function GET(req: NextRequest) {
  const suspicious = rejectSuspiciousQuery(req);
  if (suspicious) return suspicious;

  const orderNumber = normalizeOrderNumber(req.nextUrl.searchParams.get("orderNumber"));

  const limited = publicRateLimit(req, `api-orders-status:${orderNumber || "empty"}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (!/^[A-Z0-9-]{3,40}$/.test(orderNumber)) {
    return safeJson({ error: "Order not found" }, { status: 404 }, API_NO_STORE);
  }

  let order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      status: true,
      paymentMethod: true,
      playerUid: true,
      serverId: true,
      amountUsd: true,
      amountKhr: true,
      currency: true,
      createdAt: true,
      paidAt: true,
      deliveredAt: true,
      paymentExpiresAt: true,
      topupProviderRef: true,
      game: { select: { name: true, slug: true } },
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
    const lastSync = lastTopupSyncMap.get(orderNumber) || 0;
    if (now - lastSync >= 5000) {
      lastTopupSyncMap.set(orderNumber, now);
      // Clean up old cache entries periodically
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
            where: { orderNumber },
            select: {
              orderNumber: true,
              status: true,
              paymentMethod: true,
              playerUid: true,
              serverId: true,
              amountUsd: true,
              amountKhr: true,
              currency: true,
              createdAt: true,
              paidAt: true,
              deliveredAt: true,
              paymentExpiresAt: true,
              topupProviderRef: true,
              game: { select: { name: true, slug: true } },
              product: { select: { name: true } },
            },
          });
          if (fresh) order = fresh;
        }
      } catch (err) {
        console.warn("[api/orders/status] Auto topup sync error:", err);
      }
    }
  }

  const isPending = order.status === "PENDING";
  const isExpired = order.paymentExpiresAt ? order.paymentExpiresAt < new Date() : false;

  return safeJson(
    {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paidAt ? "PAID" : isPending ? "PENDING" : order.status,
      gameName: order.game.name,
      gameSlug: order.game.slug,
      productName: order.product.name,
      playerUidMasked: maskValue(order.playerUid),
      serverIdMasked: maskValue(order.serverId),
      amountUsd: order.amountUsd,
      amountKhr: order.amountKhr,
      currency: order.currency,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      payment: {
        canPay: isPending && !isExpired,
        expiresAt: order.paymentExpiresAt?.toISOString() ?? null,
      },
    },
    undefined,
    API_NO_STORE
  );
}
