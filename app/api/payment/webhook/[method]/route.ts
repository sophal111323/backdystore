import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import {
  verifyWebhook,
  parseTolaSaintWebhookEvent,
} from "@/lib/payment";
import type { PaymentMethod } from "@/lib/payment";
import { NextRequest, NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/secureLogger";
import { getClientIp } from "@/lib/getIp";
import {
  logPaymentValidationFailure,
  validatePaymentForOrder,
} from "@/lib/payment-validation";
import { notifyAndMaybeDeliverPaidOrder } from "@/lib/order-fulfillment";
import { publicRateLimit } from "@/lib/apiSecurity";

function isPrismaUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Tola Saint payment webhook.
 *
 * Official docs (https://tolasaint.com/docs):
 * - Signed POST with headers x-webhook-signature / x-webhook-timestamp /
 *   x-webhook-id, content-type application/json.
 * - Payload: { id, reference, provider, amount, currency, status,
 *   paid_at, occurred_at }
 * - Sent for statuses scanned | processing | paid | failed | expired
 *   (never for pending). Retries repeat the same payload, so processing
 *   must be idempotent (ProcessedWebhookEvent).
 *
 * Security rules enforced here:
 * 1. RAW body is read first and used for signature verification.
 * 2. Invalid signatures are rejected with 401 - never bypassed by simulation
 *    mode or any other flag.
 * 3. The webhook `reference` must match an existing order, and the payment
 *    `id` must match that order's stored paymentRef.
 * 4. Amount and currency are validated against the DB order before marking
 *    anything PAID.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ method: string }> }
) {
  try {
    const { method: methodParam } = await params;
    const method = methodParam.toUpperCase() as PaymentMethod;

    if (method !== "TOLASAINT") {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    const limited = publicRateLimit(req, `payment-webhook:` + method, {
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    // 1. RAW request body - required for exact HMAC verification.
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    // 2. Verify signature exactly per Tola Saint documentation.
    const valid = verifyWebhook(method, rawBody, headers);
    if (!valid) {
      logSecurityEvent({
        event: "webhook_invalid_signature",
        detail: method,
        ip: getClientIp(req),
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // 3. Parse the documented payload shape.
    const event = parseTolaSaintWebhookEvent(payload);
    if (!event) {
      logSecurityEvent({
        event: "payment_missing_ref",
        detail: "webhook payload missing payment id",
        ip: getClientIp(req),
      });
      return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
    }

    // Non-terminal statuses never change our order state. Nothing is sent
    // for "pending"; "scanned"/"processing" are informational only.
    if (["pending", "scanned", "processing"].includes(event.status)) {
      return NextResponse.json({ ok: true, ignored: true, status: event.status });
    }

    const transactionId = event.id;
    const orderNumber = String(event.reference ?? "").trim().toUpperCase();

    if (!orderNumber) {
      logSecurityEvent({
        event: "payment_missing_ref",
        detail: `webhook ${event.status}: no reference on payment ${transactionId}`,
        ip: getClientIp(req),
      });
      return NextResponse.json({ error: "Missing payment reference" }, { status: 400 });
    }

    // 4. Find the order this webhook belongs to.
    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) {
      logSecurityEvent({
        event: "webhook_order_mismatch",
        detail: `order not found; orderNumber=` + orderNumber + "; paymentId=" + transactionId,
        ip: getClientIp(req),
      });
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (event.status === "paid") {
      // 5. Strictly validate identity + amount + currency BEFORE going PAID.
      //    validatePaymentForOrder checks reference, paymentRef<->id match,
      //    remote amount vs stored order amount, and currency.
      const validation = validatePaymentForOrder(order, {
        orderNumber,
        transactionId,
        amount: event.amount,
        currency: event.currency,
        status: "paid",
        paid: true,
      });

      if (!validation.ok) {
        logPaymentValidationFailure("webhook", validation);
        return NextResponse.json({ error: validation.message }, { status: 400 });
      }

      if (order.status !== "PENDING") {
        if (["PAID", "PROCESSING", "DELIVERED"].includes(order.status)) {
          return NextResponse.json({ ok: true, skipped: true, reason: "already_paid" });
        }

        return NextResponse.json(
          { error: "Order is not pending and cannot be marked paid" },
          { status: 409 }
        );
      }

      // 6. Idempotent transition to PAID (ProcessedWebhookEvent + guarded
      //    updateMany so duplicate/replayed webhooks cannot double-process).
      let fullOrder = null;
      try {
        fullOrder = await prisma.$transaction(async (tx: any) => {
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
            throw new Error("Order payment update lost a race or no longer matches paymentRef.");
          }

          return tx.order.findUnique({
            where: { id: order.id },
            include: { game: true, product: true },
          });
        });
      } catch (error) {
        if (isPrismaUniqueError(error)) {
          logSecurityEvent({
            event: "webhook_replay_blocked",
            detail: `transactionId=` + validation.transactionId + "; order=" + order.orderNumber,
          });
          return NextResponse.json({ ok: true, skipped: true, reason: "replay" });
        }
        throw error;
      }

      if (fullOrder) {
        await notifyAndMaybeDeliverPaidOrder(fullOrder.id);
      }
    } else {
      // failed / expired - only touch orders still waiting on THIS payment.
      if (!order.paymentRef || order.paymentRef !== transactionId) {
        logSecurityEvent({
          event: "payment_transaction_mismatch",
          detail: `webhook ` + event.status + ": got=" + transactionId + "; expected=" + (order.paymentRef || "missing") + "; order=" + order.orderNumber,
        });
        return NextResponse.json(
          { error: "Payment transaction does not match order" },
          { status: 400 }
        );
      }

      if (order.status === "PENDING") {
        try {
          await prisma.$transaction(async (tx: any) => {
            await tx.processedWebhookEvent.create({
              data: {
                transactionId,
                orderNumber: order.orderNumber,
                processedAt: new Date(),
              },
            });

            await tx.order.update({
              where: { id: order.id },
              data: {
                status: event.status === "expired" ? "CANCELLED" : "FAILED",
                failureReason: `Tola Saint: ` + event.status,
              },
            });
          });
        } catch (error) {
          if (isPrismaUniqueError(error)) {
            return NextResponse.json({ ok: true, skipped: true, reason: "replay" });
          }
          throw error;
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
