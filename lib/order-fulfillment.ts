import { prisma } from "@/lib/prisma";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { fulfillPaidOrder } from "@/lib/fulfillment";

/**
 * Runs post-payment work after an order safely transitions to PAID.
 *
 * This keeps the NEW strict payment verification flow, but uses the OLD working
 * top-up delivery method:
 *   PAID -> PROCESSING -> Bay2Game /create_order -> DELIVERED
 */
export async function notifyAndMaybeDeliverPaidOrder(orderId: string) {
  const fullOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: { game: true, product: true },
  });

  if (!fullOrder) return null;

  const baseUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
  const link = baseUrl
    ? `\n<a href="${baseUrl}/admin/orders/${fullOrder.orderNumber}">Open in admin</a>`
    : "";

  // Buyer identity (username/contact) — whichever fields were provided at checkout.
  const customerLines = [
    fullOrder.customerEmail ? `📧 ${escapeHtml(fullOrder.customerEmail)}` : null,
    fullOrder.customerPhone ? `📱 ${escapeHtml(fullOrder.customerPhone)}` : null,
    fullOrder.playerNickname ? `🎮 Nickname: ${escapeHtml(fullOrder.playerNickname)}` : null,
  ].filter(Boolean);

  await notifyTelegram(
    `💰 <b>Payment successful!</b>\n` +
      `<b>#${escapeHtml(fullOrder.orderNumber)}</b>\n` +
      `${escapeHtml(fullOrder.game.name)} – ${escapeHtml(fullOrder.product.name)}\n` +
      `UID: <code>${escapeHtml(fullOrder.playerUid)}</code>\n` +
      (customerLines.length > 0 ? `${customerLines.join("\n")}\n` : "") +
      `Amount: $${fullOrder.amountUsd.toFixed(2)}\n` +
      `Method: ${escapeHtml(fullOrder.paymentMethod || "KHQR")}${link}`
  );

  return fulfillPaidOrder(fullOrder.orderNumber);
}
