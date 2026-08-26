import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { writeAuditForAdmin } from "@/lib/audit";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { createAdminNotification } from "@/lib/adminNotifications";
import { revalidateAdminChange } from "@/lib/adminRevalidate";
import { logSecurityEvent } from "@/lib/secureLogger";
import { normalizeAdminRole } from "@/lib/adminPermissions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";

const statusSchema = z.enum([
  "PENDING",
  "PAID",
  "PROCESSING",
  "DELIVERED",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
]);

const updateSchema = z.object({
  status: statusSchema.optional(),
  deliveryNote: z.string().max(2000).optional(),
  failureReason: z.string().max(2000).optional(),
  adminNote: z.string().max(2000).optional(),
  // Security: manual PAID requires explicit confirmation
  confirmManualPaid: z.boolean().optional(),
});

function normalizeStatus(status?: string) {
  if (!status) return undefined;
  return status === "COMPLETED" ? "DELIVERED" : status;
}

export const GET = withAdminAuth(
  async (_req, { params }: { params: Promise<{ orderNumber: string }> }) => {
    const { orderNumber } = await params;
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        game: true,
        product: true,
        promoCode: true,
      },
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(order);
  },
  { permission: "orders.read" }
);

export const PATCH = withAdminAuth(
  async (req, { params }: { params: Promise<{ orderNumber: string }> }, admin) => {
    const { orderNumber } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { game: { select: { slug: true, name: true } }, product: { select: { name: true } } },
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const nextStatus = normalizeStatus(parsed.data.status);

    // ── Security: Manual PAID requires explicit confirmation + OWNER role ──
    // This prevents fake payment confirmations from screenshots/messages.
    // Only gateway webhooks or OWNER with explicit confirm can mark PAID.
    if (nextStatus === "PAID" && order.status !== "PAID") {
      const role = normalizeAdminRole(admin.role);

      if (role !== "OWNER") {
        return NextResponse.json(
          { error: "Only the site owner can manually mark orders as PAID. Use the gateway refresh button for gateway-verified payments." },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }

      if (parsed.data.confirmManualPaid !== true) {
        return NextResponse.json(
          { error: "Manual PAID requires confirmManualPaid:true. Use the gateway refresh button for gateway-verified payments." },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      logSecurityEvent({
        event: "admin_settings_changed",
        adminId: admin.id,
        detail: `Manual PAID override: order=${orderNumber}, amount=$${order.amountUsd}`,
      });
    }

    const data: any = {
      ...(parsed.data.deliveryNote !== undefined ? { deliveryNote: parsed.data.deliveryNote } : {}),
      ...(parsed.data.failureReason !== undefined ? { failureReason: parsed.data.failureReason } : {}),
    };

    if (nextStatus) {
      data.status = nextStatus;
      if (nextStatus === "DELIVERED" && !order.deliveredAt) data.deliveredAt = new Date();
      if (nextStatus === "PAID" && !order.paidAt) data.paidAt = new Date();
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data,
      include: {
        game: { select: { id: true, name: true, slug: true } },
        product: { select: { id: true, name: true } },
      },
    });

    if (nextStatus && nextStatus !== order.status) {
      const isManualPaid = nextStatus === "PAID" && parsed.data.confirmManualPaid === true;

      await writeAuditForAdmin(admin, req, {
        action: isManualPaid ? "order.manual_paid" : "order.status.update",
        targetType: "order",
        targetId: order.orderNumber,
        details: {
          from: order.status,
          to: nextStatus,
          adminNote: parsed.data.adminNote || null,
          ...(isManualPaid ? { manualOverride: true } : {}),
        },
      });

      await createAdminNotification({
        type: "order.updated",
        title: isManualPaid ? "⚠️ Order manually marked PAID" : "Order status updated",
        message: `${order.orderNumber}: ${order.status} → ${nextStatus}${isManualPaid ? " (MANUAL OVERRIDE)" : ""}`,
        targetType: "order",
        targetId: order.orderNumber,
      });

      if (nextStatus === "DELIVERED" || nextStatus === "PAID") {
        const prefix = isManualPaid
          ? `⚠️ <b>MANUAL PAID (admin override)</b>`
          : `✅ <b>Order ${escapeHtml(nextStatus)}</b>`;
        await notifyTelegram(
          `${prefix}\n` +
            `#${escapeHtml(order.orderNumber)} — $${order.amountUsd.toFixed(2)}\n` +
            `UID: <code>${escapeHtml(order.playerUid)}</code>\n` +
            `Admin: ${escapeHtml(admin.email)}`
        );
      }
    } else if (parsed.data.deliveryNote || parsed.data.failureReason || parsed.data.adminNote) {
      await writeAuditForAdmin(admin, req, {
        action: "order.note.update",
        targetType: "order",
        targetId: order.orderNumber,
        details: {
          deliveryNote: parsed.data.deliveryNote || null,
          failureReason: parsed.data.failureReason || null,
          adminNote: parsed.data.adminNote || null,
        },
      });
    }

    revalidateAdminChange("orders", { orderNumber: order.orderNumber });

    return NextResponse.json(updated);
  },
  { permission: "orders.update" }
);
