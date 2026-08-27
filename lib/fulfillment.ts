// lib/fulfillment.ts
//
// Game top-up fulfillment. Runs ONLY after an order is PAID:
//   PAID -> PROCESSING -> Supplier create_order (Bay2Game / Khmer TopUp) -> DELIVERED
//
// IDEMPOTENCY RULES (prevents duplicate top-ups / real financial loss):
//   • An order that already has topupProviderRef NEVER creates a new top-up.
//     It only re-checks the existing transaction via /check_order.
//   • On network timeout, outcome at the provider is UNKNOWN — the order
//     stays PROCESSING and is resolved later via refreshTopupStatus().
//     We never blindly retry creation.

import { prisma } from "@/lib/prisma";
import { getSupplier, getTopupStatus } from "@/lib/topup";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";

export interface FulfillmentResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
  transactionId?: string;
  status?: string;
}

export interface FulfillOptions {
  silentTelegram?: boolean;
}

function manualReviewMessage(
  title: string,
  orderNumber: string,
  gameName: string,
  productName: string,
  playerUid: string,
  detail: string
): string {
  const baseUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
  const link = baseUrl
    ? `\n<a href="${baseUrl}/admin/orders/${orderNumber}">Open in admin</a>`
    : "";

  return (
    `${title}\n` +
    `#${escapeHtml(orderNumber)}\n` +
    `${escapeHtml(gameName)} – ${escapeHtml(productName)}\n` +
    `UID: <code>${escapeHtml(playerUid)}</code>\n` +
    `${detail}${link}`
  );
}

export async function fulfillPaidOrder(
  orderNumber: string,
  options?: FulfillOptions
): Promise<FulfillmentResult> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { game: true, product: true },
  });

  if (!order) return { success: false, error: "Order not found" };

  if (order.status === "DELIVERED") {
    return { success: true, skipped: true, status: "already_delivered" };
  }

  // Already claimed by another fulfillment run — check provider instead of
  // creating anything new.
  if (order.status === "PROCESSING") {
    if (order.topupProviderRef) {
      return refreshTopupStatus(orderNumber);
    }
    return { success: false, skipped: true, status: "already_processing" };
  }

  if (order.status !== "PAID") {
    return { success: false, skipped: true, status: `not_paid:${order.status}` };
  }

  // Resolve supplier dynamically based on product configuration
  const supplierName = (order.product?.supplier || order.topupProvider || "bay2game").toLowerCase();
  const supplier = getSupplier(supplierName);

  // ── Idempotency guard #1: this order already has a provider transaction ──
  // A DEFINITE failure (topupStatus === "failed") means the provider rejected the
  // creation — nothing was delivered. It is safe to re-attempt using the SAME
  // reference (references are unique, so a duplicate delivery is
  // impossible). Unknown/pending outcomes must only be status-checked.
  if (order.topupProviderRef && order.topupStatus !== "failed") {
    return refreshTopupStatus(orderNumber);
  }

  if (order.topupProviderRef) {
    // Previous attempt failed definitively. Double-check the provider before
    // creating again — if the first attempt actually succeeded we must NOT
    // create a second top-up.
    const remote = await getTopupStatus(order.topupProviderRef, order.topupProvider || supplier.name);
    if (remote.found && (remote.status === "success" || remote.status === "completed")) {
      const rawResp = remote.rawResponse ? JSON.stringify(remote.rawResponse) : null;
      await prisma.order.updateMany({
        where: { id: order.id, status: { in: ["PROCESSING", "PAID"] } },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          deliveryNote: `Auto-delivered via ${supplier.displayName}. Ref: ${remote.transactionId ?? order.topupProviderRef}`,
          failureReason: null,
          topupStatus: "success",
          supplierResponse: rawResp,
        },
      });
      return { success: true, transactionId: remote.transactionId, status: "success" };
    }
    if (remote.found && remote.status !== "failed") {
      // Transaction exists and is still in progress.
      return refreshTopupStatus(orderNumber);
    }
    // Not found at the provider, or definitively failed there → safe to
    // re-create below with the same unique reference.
  }

  if (!order.product.supplierCode) {
    if (!options?.silentTelegram) {
      await notifyTelegram(
        manualReviewMessage(
          "🔔 <b>Manual topup required</b>",
          order.orderNumber,
          order.game.name,
          order.product.name,
          order.playerUid,
          `(${order.product.name} has no ${supplier.displayName} product code / package ID)`
        )
      );
    }

    return {
      success: false,
      skipped: true,
      error: `Product has no supplierCode for ${supplier.displayName}`,
    };
  }

  // Claim the order atomically so two concurrent runs can't both create a
  // top-up. Only one transition PAID → PROCESSING can succeed. A failed
  // previous attempt may be claimed again (same reference, no duplicates).
  const claimed = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: "PAID",
      OR: [{ topupProviderRef: null }, { topupStatus: "failed" }],
    },
    data: {
      status: "PROCESSING",
      deliveryNote: `Auto topup is being processed via ${supplier.displayName}.`,
    },
  });

  if (claimed.count !== 1) {
    return { success: false, skipped: true, status: "not_claimed" };
  }

  const reference = order.orderNumber;

  const topupResult = await supplier.createOrder({
    orderReference: reference,
    productCode: order.product.supplierCode,
    playerId: order.playerUid,
    serverId: order.serverId ?? undefined,
  });

  const transactionRef = topupResult.transactionId || reference;
  const rawResp = topupResult.rawResponse ? JSON.stringify(topupResult.rawResponse) : null;

  // Record the provider reference immediately — even on failure/unknown —
  // so no later run can ever create a second transaction for this order.
  await prisma.order.update({
    where: { id: order.id },
    data: {
      topupProvider: supplier.name,
      topupProviderRef: transactionRef,
      topupStatus: topupResult.success
        ? (topupResult.status === "completed" || topupResult.status === "success" ? "success" : "pending")
        : (topupResult.unknown ? "pending" : "failed"),
      supplierResponse: rawResp,
    },
  });

  if (topupResult.success) {
    const isInstantComplete = topupResult.status === "completed" || topupResult.status === "success";

    if (isInstantComplete) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          deliveryNote: `Auto-delivered via ${supplier.displayName}. Ref: ${transactionRef}`,
          failureReason: null,
          topupStatus: "success",
        },
      });

      if (!options?.silentTelegram) {
        await notifyTelegram(
          manualReviewMessage(
            `✅ <b>Auto topup DELIVERED (${escapeHtml(supplier.displayName)})</b>`,
            order.orderNumber,
            order.game.name,
            order.product.name,
            order.playerUid,
            `${escapeHtml(supplier.displayName)} ref: <code>${escapeHtml(transactionRef)}</code>`
          )
        );
      }

      return {
        success: true,
        transactionId: transactionRef,
        status: "success",
      };
    } else {
      // Async processing (e.g. Khmer TopUp status === "processing")
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PROCESSING",
          deliveryNote: `Top-up submitted to ${supplier.displayName} (processing). Ref: ${transactionRef}`,
          failureReason: null,
          topupStatus: "pending",
        },
      });

      if (!options?.silentTelegram) {
        await notifyTelegram(
          manualReviewMessage(
            `⏳ <b>Topup PROCESSING (${escapeHtml(supplier.displayName)})</b>`,
            order.orderNumber,
            order.game.name,
            order.product.name,
            order.playerUid,
            `${escapeHtml(supplier.displayName)} ref: <code>${escapeHtml(transactionRef)}</code> (processing)`
          )
        );
      }

      return {
        success: true,
        transactionId: transactionRef,
        status: "processing",
      };
    }
  }

  if (topupResult.unknown) {
    // Network timeout — outcome UNKNOWN at the provider. Do NOT revert to
    // PAID and do NOT retry creation; leave PROCESSING for a later status
    // check against checkOrder.
    await prisma.order.update({
      where: { id: order.id },
      data: {
        deliveryNote:
          `${supplier.displayName} did not respond in time. Outcome unknown — checking existing transaction before any retry.`,
      },
    });

    if (!options?.silentTelegram) {
      await notifyTelegram(
        manualReviewMessage(
          "⏳ <b>Topup pending verification</b>",
          order.orderNumber,
          order.game.name,
          order.product.name,
          order.playerUid,
          `${supplier.displayName} timed out. Use Refresh Status — do NOT create a new top-up.`
        )
      );
    }

    return {
      success: false,
      skipped: true,
      status: "processing_unknown",
      error: topupResult.error,
    };
  }

  // Definite provider rejection (invalid product/player, insufficient
  // balance, ...) — hand back to admin for manual processing.
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      failureReason: `Auto topup failed (${supplier.displayName}): ${topupResult.error ?? "unknown"}`,
      deliveryNote: `Auto topup failed via ${supplier.displayName}. Please process this order manually.`,
    },
  });

  if (!options?.silentTelegram) {
    await notifyTelegram(
      manualReviewMessage(
        `⚠️ <b>Auto topup FAILED (${escapeHtml(supplier.displayName)}) — process manually</b>`,
        order.orderNumber,
        order.game.name,
        order.product.name,
        order.playerUid,
        `Error: ${escapeHtml(topupResult.error ?? "unknown")}`
      )
    );
  }

  return {
    success: false,
    error: topupResult.error ?? "unknown",
  };
}

/**
 * Re-check an existing provider transaction via checkOrder and update the
 * local order accordingly. NEVER creates a new top-up.
 */
export async function refreshTopupStatus(orderNumber: string): Promise<FulfillmentResult> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { game: true, product: true },
  });

  if (!order) return { success: false, error: "Order not found" };

  const reference = order.topupProviderRef;
  if (!reference) {
    return { success: false, skipped: true, status: "no_provider_ref" };
  }

  if (order.status === "DELIVERED") {
    return { success: true, skipped: true, status: "already_delivered" };
  }

  const supplierName = (order.topupProvider || order.product?.supplier || "bay2game").toLowerCase();
  const supplier = getSupplier(supplierName);

  const remote = await getTopupStatus(reference, supplier.name);
  const rawResp = remote.rawResponse ? JSON.stringify(remote.rawResponse) : null;

  if (!remote.found) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        topupStatus: "pending",
        ...(rawResp ? { supplierResponse: rawResp } : {}),
      },
    });
    return {
      success: false,
      skipped: true,
      status: "provider_status_unavailable",
      error: remote.error,
    };
  }

  if (remote.status === "success" || remote.status === "completed") {
    const updated = await prisma.order.updateMany({
      where: { id: order.id, status: { in: ["PROCESSING", "PAID"] } },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        deliveryNote: `Auto-delivered via ${supplier.displayName}. Ref: ${remote.transactionId ?? reference}`,
        failureReason: null,
        topupStatus: "success",
        supplierResponse: rawResp,
      },
    });

    if (updated.count === 1) {
      await notifyTelegram(
        manualReviewMessage(
          `✅ <b>Auto topup DELIVERED (${escapeHtml(supplier.displayName)})</b>`,
          order.orderNumber,
          order.game.name,
          order.product.name,
          order.playerUid,
          `${escapeHtml(supplier.displayName)} ref: <code>${escapeHtml(remote.transactionId ?? reference)}</code> (status refresh)`
        )
      );
    }

    return { success: true, transactionId: remote.transactionId, status: "success" };
  }

  if (remote.status === "failed") {
    await prisma.order.updateMany({
      where: { id: order.id, status: { in: ["PROCESSING", "PAID"] } },
      data: {
        status: "PAID",
        failureReason: `${supplier.displayName} reported the top-up as failed.`,
        deliveryNote: `Auto topup failed at ${supplier.displayName}. Please process this order manually.`,
        topupStatus: "failed",
        supplierResponse: rawResp,
      },
    });

    await notifyTelegram(
      manualReviewMessage(
        `⚠️ <b>Auto topup FAILED (${escapeHtml(supplier.displayName)}) — process manually</b>`,
        order.orderNumber,
        order.game.name,
        order.product.name,
        order.playerUid,
        `${supplier.displayName} reported FAILED.`
      )
    );

    return { success: false, status: "failed", error: `${supplier.displayName} reported failed` };
  }

  // Still pending / processing at the provider.
  await prisma.order.update({
    where: { id: order.id },
    data: {
      topupStatus: "pending",
      ...(rawResp ? { supplierResponse: rawResp } : {}),
    },
  });
  return { success: false, skipped: true, status: "still_pending" };
}




