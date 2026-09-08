import { prisma } from "@/lib/prisma";
import { fetchPaymentStatus } from "@/lib/payment";
import {
  isRemotePaid,
  validatePaymentForOrder,
  logPaymentValidationFailure,
} from "@/lib/payment-validation";
import { notifyAndMaybeDeliverPaidOrder } from "@/lib/order-fulfillment";
import { fulfillPaidOrder, refreshTopupStatus } from "@/lib/fulfillment";

/**
 * Checks a single pending order against Tola Saint payment gateway.
 * If paid, atomically marks PAID and triggers supplier top-up fulfillment + Telegram alert.
 */
export async function syncSinglePendingOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (
    !order ||
    order.status !== "PENDING" ||
    !order.paymentRef ||
    order.paymentRef.startsWith("SIM-")
  ) {
    return false;
  }

  const remote = await fetchPaymentStatus(order.paymentRef);
  if (!remote || !isRemotePaid(remote)) {
    return false;
  }

  const validation = validatePaymentForOrder(order, {
    orderNumber: remote.orderNumber || order.orderNumber,
    transactionId: remote.transactionId ?? order.paymentRef,
    amount: remote.amount,
    currency: remote.currency,
    status: remote.status,
    paid: remote.paid,
  });

  if (!validation.ok) {
    logPaymentValidationFailure("internal_sync", validation);
    return false;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Record idempotency event to avoid double-processing
      await tx.processedWebhookEvent.create({
        data: {
          transactionId: validation.transactionId,
          orderNumber: order.orderNumber,
          processedAt: new Date(),
        },
      });

      const res = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "PENDING",
          paymentRef: validation.transactionId,
        },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      });

      return res.count === 1;
    });

    if (updated) {
      console.log(`[paymentSync] Order ${order.orderNumber} successfully paid! Fulfilling top-up...`);
      await notifyAndMaybeDeliverPaidOrder(order.id);
      return true;
    }
  } catch {
    // If already processed, ignore safely
  }

  return false;
}

/**
 * Scans all recent pending orders (created in the last 20 minutes) and syncs payments.
 */
export async function syncAllRecentPendingOrders(): Promise<number> {
  const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

  const pendingOrders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      createdAt: { gte: twentyMinutesAgo },
      paymentRef: { not: null },
    },
    select: { id: true, orderNumber: true, paymentRef: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  let syncedCount = 0;
  for (const order of pendingOrders) {
    if (!order.paymentRef || order.paymentRef.startsWith("SIM-")) continue;
    try {
      const ok = await syncSinglePendingOrder(order.id);
      if (ok) syncedCount++;
    } catch (e) {
      console.warn(`[paymentSync] Error syncing ${order.orderNumber}:`, e);
    }
  }

  return syncedCount;
}

const lastProcessingCheckMap = new Map<string, number>();

/**
 * Scans all recent PROCESSING orders (created in the last 24 hours) and checks supplier status.
 * Once the supplier (FrozenYuki, Bay2Game, etc.) finishes the delivery, this automatically:
 *   1. Updates the order in the database to DELIVERED
 *   2. Sends the Telegram notification "Auto topup DELIVERED" immediately
 *
 * This completely eliminates the need for the user/admin to visit /order to trigger delivery!
 */
export async function syncAllRecentProcessingOrders(): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const now = Date.now();

  const processingOrders = await prisma.order.findMany({
    where: {
      status: "PROCESSING",
      topupProviderRef: { not: null },
      createdAt: { gte: oneDayAgo },
    },
    select: { id: true, orderNumber: true, topupProviderRef: true },
    orderBy: { updatedAt: "asc" },
    take: 15,
  });

  let deliveredCount = 0;
  for (const order of processingOrders) {
    const lastCheck = lastProcessingCheckMap.get(order.orderNumber) || 0;
    // Debounce checks per order: at most once every 4 seconds to be gentle with supplier APIs
    if (now - lastCheck < 4000) continue;
    lastProcessingCheckMap.set(order.orderNumber, now);

    try {
      const res = await refreshTopupStatus(order.orderNumber);
      if (
        res.success &&
        (res.status === "success" ||
          res.status === "completed" ||
          res.status === "already_delivered")
      ) {
        console.log(`[paymentSync] Order ${order.orderNumber} auto-delivered via supplier!`);
        deliveredCount++;
        lastProcessingCheckMap.delete(order.orderNumber);
      } else if (res.status === "failed") {
        lastProcessingCheckMap.delete(order.orderNumber);
      }
    } catch (e) {
      console.warn(`[paymentSync] Error checking topup status for ${order.orderNumber}:`, e);
    }
  }

  if (lastProcessingCheckMap.size > 200) {
    lastProcessingCheckMap.clear();
  }

  return deliveredCount;
}

/**
 * Scans for any orders in PAID status that haven't been fulfilled yet,
 * and triggers top-up fulfillment with the supplier.
 */
export async function syncAllRecentPaidOrders(): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const paidOrders = await prisma.order.findMany({
    where: {
      status: "PAID",
      createdAt: { gte: oneHourAgo },
    },
    select: { id: true, orderNumber: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  let fulfilledCount = 0;
  for (const order of paidOrders) {
    try {
      const res = await fulfillPaidOrder(order.orderNumber);
      if (res.success) fulfilledCount++;
    } catch (e) {
      console.warn(`[paymentSync] Error fulfilling paid order ${order.orderNumber}:`, e);
    }
  }

  return fulfilledCount;
}

/**
 * Background worker that continuously monitors and syncs:
 *   1. PENDING orders (detects when customer pays via KHQR)
 *   2. PAID orders (triggers supplier top-up)
 *   3. PROCESSING orders (detects when supplier delivers and sends Telegram notification)
 * Runs on the server in the background without blocking anything.
 */
const state = globalThis as unknown as { __paymentSyncWorkerRunning?: boolean };

export function startPendingOrdersSyncWorker(): void {
  if (typeof window !== "undefined") return;
  if (process.env.NODE_ENV === "development" && process.env.ENABLE_LOCAL_WORKERS !== "true") {
    return;
  }
  if (state.__paymentSyncWorkerRunning) return;
  state.__paymentSyncWorkerRunning = true;

  console.log("[paymentSync] Starting background automated order payment & top-up delivery worker...");

  let isBusy = false;
  const interval = setInterval(async () => {
    if (isBusy) return;
    isBusy = true;
    try {
      // 1. Check KHQR payments for pending orders
      await syncAllRecentPendingOrders();

      // 2. Fulfill any paid orders that need top-up
      await syncAllRecentPaidOrders();

      // 3. Monitor processing top-ups and auto-deliver + send Telegram alerts when completed
      await syncAllRecentProcessingOrders();
    } catch (err) {
      console.warn("[paymentSync] Background worker cycle error:", err);
    } finally {
      isBusy = false;
    }
  }, 4000); // Runs every 4 seconds

  if (interval.unref) {
    interval.unref();
  }
}
