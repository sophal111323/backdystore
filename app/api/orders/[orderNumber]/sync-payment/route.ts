import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { fetchPaymentStatus } from "@/lib/payment";
import {
  isRemotePaid,
  logPaymentValidationFailure,
  validatePaymentForOrder,
} from "@/lib/payment-validation";
import { applyRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getIp";
import { logSecurityEvent } from "@/lib/secureLogger";
import { notifyAndMaybeDeliverPaidOrder } from "@/lib/order-fulfillment";

function isPrismaUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Safe client-triggered payment sync (Tola Saint fallback polling).
 *
 * Why this exists:
 * - The Tola Saint webhook is PRIMARY. This endpoint is a FALLBACK so the
 *   open checkout page can confirm payment even if a webhook is delayed.
 * - Rate limits: Tola Saint allows 30 status checks/min per payment id, so
 *   the existing client cadence (~10s) is well within budget.
 *
 * Security rule:
 * - This never trusts the browser. It only marks PAID after the server checks
 *   Tola Saint and validates transactionId/paymentRef + amount + currency.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  const normalizedOrderNumber = orderNumber.toUpperCase();
  const ip = getClientIp(req);

  const rl = await applyRateLimit(
    `payment-sync:${normalizedOrderNumber}:${ip}`,
    30,
    5 * 60 * 1000,
    ip
  );
  if (rl) return rl;

  const order = await prisma.order.findUnique({
    where: { orderNumber: normalizedOrderNumber },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.status !== "PENDING") {
    return NextResponse.json({ ok: true, status: order.status, changed: false });
  }

  if (!order.paymentRef || order.paymentRef.startsWith("SIM-")) {
    return NextResponse.json(
      { ok: false, status: order.status, error: "No real Tola Saint reference on order" },
      { status: 400 }
    );
  }

  const remote = await fetchPaymentStatus(order.paymentRef);
  if (!remote) {
    return NextResponse.json(
      { ok: false, status: order.status, error: "Unable to fetch remote payment status" },
      { status: 502 }
    );
  }

  if (!isRemotePaid(remote)) {
    return NextResponse.json({
      ok: true,
      status: order.status,
      changed: false,
      providerStatus: remote.status,
    });
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
    logPaymentValidationFailure("public_sync", validation);
    return NextResponse.json(
      { ok: false, status: order.status, error: validation.message, code: validation.code },
      { status: 400 }
    );
  }

  try {
    const updatedOrderId = await prisma.$transaction(async (tx: any) => {
      await tx.processedWebhookEvent.create({
        data: {
          transactionId: validation.transactionId,
          orderNumber: order.orderNumber,
          processedAt: new Date(),
        },
      });

      const updated = await tx.order.updateMany({
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

      if (updated.count !== 1) {
        throw new Error("Order changed before payment sync could complete.");
      }

      return order.id;
    });

    await notifyAndMaybeDeliverPaidOrder(updatedOrderId);

    return NextResponse.json({
      ok: true,
      status: "PAID",
      changed: true,
      providerStatus: remote.status,
    });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ ok: true, status: order.status, changed: false, reason: "already_processed" });
    }

    logSecurityEvent({
      event: "payment_public_sync_blocked",
      detail: error instanceof Error ? error.message : "payment sync failed",
      ip,
    });

    return NextResponse.json(
      { ok: false, status: order.status, error: "Payment sync failed" },
      { status: 500 }
    );
  }
}
