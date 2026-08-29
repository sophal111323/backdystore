// app/api/webhooks/frozenyuki/route.ts
//
// FrozenYuki / SoraTopup Webhook Handler.
//
// Event format:
//   {
//     "event": "order.update",
//     "ref": "API...",
//     "status": "Success" | "Failed" | "Processing",
//     "game": "Free Fire",
//     "item": "W.Card",
//     "player": "123",
//     "amount": 1.49,
//     "time": "..."
//   }
//
// Security:
//   - Verifies X-FrozenYuki-Signature header (HMAC-SHA256 of raw body)
//   - Idempotent: safe against duplicate deliveries
//   - Updates order to DELIVERED atomically upon Success

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizeFrozenYukiStatus } from "@/lib/topup/providers/frozenyuki";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { getClientIp } from "@/lib/getIp";
import { logSecurityEvent } from "@/lib/secureLogger";
import { publicRateLimit } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanEnv(value?: string): string {
  return (value || "").trim().replace(/^['"]|['"]$/g, "");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const limited = publicRateLimit(req, "webhook-frozenyuki", {
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const rawBody = await req.text();
  const webhookSecret =
    cleanEnv(process.env.FROZENYUKI_WEBHOOK_SECRET) ||
    cleanEnv(process.env.SORATOPUP_WEBHOOK_SECRET);

  // 1. Signature validation (if secret is configured)
  if (webhookSecret) {
    const rawSig =
      req.headers.get("x-frozenyuki-signature") ||
      req.headers.get("x-signature") ||
      "";

    const expectedHash = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const expectedSigWithPrefix = `sha256=${expectedHash}`;
    const isValid =
      timingSafeEqualStr(rawSig, expectedSigWithPrefix) ||
      timingSafeEqualStr(rawSig, expectedHash);

    if (!isValid) {
      logSecurityEvent({
        event: "webhook_invalid_signature",
        detail: "FrozenYuki signature verification failed",
        ip: getClientIp(req),
      });

      return NextResponse.json(
        { ok: false, error: "Invalid signature" },
        { status: 401 }
      );
    }
  }

  // 2. Parse payload safely
  let payload: any = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: false, error: "Empty payload" }, { status: 400 });
  }

  const providerRef = payload.ref || payload.refid || payload.order_id || payload.id;
  if (!providerRef || typeof providerRef !== "string") {
    return NextResponse.json(
      { ok: true, message: "Ignored: Missing order reference" },
      { status: 200 }
    );
  }

  // 3. Find target order in database
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { topupProviderRef: providerRef },
        { orderNumber: providerRef },
      ],
    },
    include: { game: true, product: true },
  });

  if (!order) {
    console.warn(`[frozenyuki-webhook] Order not found for ref: ${providerRef}`);
    return NextResponse.json(
      { ok: true, message: "Order not found or already processed" },
      { status: 200 }
    );
  }

  const rawStatus = payload.status || payload.order_status || "";
  const normStatus = normalizeFrozenYukiStatus(rawStatus);

  console.log(
    `[frozenyuki-webhook] order #${order.orderNumber} ref=${providerRef} status=${rawStatus} (normalized: ${normStatus})`
  );

  // 4. Update order status idempotently
  if (normStatus === "success") {
    if (order.status !== "DELIVERED") {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          deliveryNote: `Auto-delivered via FrozenYuki Webhook. Ref: ${providerRef}`,
          failureReason: null,
          topupStatus: "success",
          supplierResponse: rawBody,
        },
      });

      const baseUrl =
        process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
      const link = baseUrl
        ? `\n<a href="${baseUrl}/admin/orders/${order.orderNumber}">Open in admin</a>`
        : "";

      await notifyTelegram(
        `✅ <b>Topup DELIVERED (FrozenYuki)</b>\n` +
          `#${escapeHtml(order.orderNumber)}\n` +
          `${escapeHtml(order.game?.name || "Game")} – ${escapeHtml(
            order.product?.name || "Package"
          )}\n` +
          `UID: <code>${escapeHtml(order.playerUid)}</code>\n` +
          `Ref: <code>${escapeHtml(providerRef)}</code>${link}`
      ).catch(() => {});
    }
  } else if (normStatus === "failed") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        topupStatus: "failed",
        failureReason: payload.msg || payload.error || "Provider rejected delivery",
        supplierResponse: rawBody,
      },
    });

    await notifyTelegram(
      `⚠️ <b>Topup FAILED (FrozenYuki Webhook)</b>\n` +
        `#${escapeHtml(order.orderNumber)}\n` +
        `UID: <code>${escapeHtml(order.playerUid)}</code>\n` +
        `Ref: <code>${escapeHtml(providerRef)}</code>\n` +
        `Error: ${escapeHtml(payload.msg || payload.error || "Delivery failed")}`
    ).catch(() => {});
  } else {
    // In progress / processing
    await prisma.order.update({
      where: { id: order.id },
      data: {
        topupStatus: "pending",
        supplierResponse: rawBody,
      },
    });
  }

  return NextResponse.json({ ok: true, received: true });
}
