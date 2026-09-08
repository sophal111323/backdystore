import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";
import { syncSinglePendingOrder } from "@/lib/paymentSyncService";
import { fulfillPaidOrder, refreshTopupStatus } from "@/lib/fulfillment";

export const POST = withAdminAuth(
  async (req, _ctx, admin) => {
    const body = await req.json().catch(() => ({}));
    const {
      orderNumber,
      orderNumbers,
      status = "ALL",
      all = false,
      forceRetryFailed = false,
    } = body;

    // Helper to process a single order record
    async function processOrder(order: {
      id: string;
      orderNumber: string;
      status: string;
      paymentRef: string | null;
      topupProviderRef: string | null;
      paidAt: Date | null;
    }) {
      const num = order.orderNumber;
      try {
        if (order.status === "PENDING") {
          const synced = await syncSinglePendingOrder(order.id);
          if (synced) {
            return {
              orderNumber: num,
              action: "payment_sync",
              status: "PAID_AND_FULFILLED",
              success: true,
              message: "Payment verified from gateway and top-up triggered",
            };
          } else {
            return {
              orderNumber: num,
              action: "payment_sync",
              status: "PENDING",
              success: false,
              message: "Still waiting for customer payment / no update",
            };
          }
        }

        if (order.status === "PAID") {
          const result = await fulfillPaidOrder(num);
          return {
            orderNumber: num,
            action: "fulfill_topup",
            status: result.success ? "DELIVERED" : (result.status || "FAILED"),
            success: result.success,
            error: result.error,
            message: result.success
              ? "Top-up fulfilled successfully"
              : (result.error || "Fulfillment failed"),
          };
        }

        if (order.status === "PROCESSING") {
          if (order.topupProviderRef) {
            const result = await refreshTopupStatus(num);
            return {
              orderNumber: num,
              action: "refresh_status",
              status: result.status || (result.success ? "DELIVERED" : "PROCESSING"),
              success: result.success,
              error: result.error,
              message: result.success
                ? "Top-up confirmed delivered"
                : (result.error || "Still processing at supplier"),
            };
          } else {
            const result = await fulfillPaidOrder(num);
            return {
              orderNumber: num,
              action: "fulfill_topup",
              status: result.success ? "DELIVERED" : (result.status || "PROCESSING"),
              success: result.success,
              error: result.error,
              message: result.error || (result.success ? "Top-up fulfilled" : "Processing"),
            };
          }
        }

        if (order.status === "FAILED" && forceRetryFailed) {
          if (order.topupProviderRef) {
            const result = await refreshTopupStatus(num);
            return {
              orderNumber: num,
              action: "refresh_status",
              status: result.status || "FAILED",
              success: result.success,
              error: result.error,
            };
          } else if (order.paidAt) {
            await prisma.order.update({
              where: { id: order.id },
              data: { status: "PAID", failureReason: null },
            });
            const result = await fulfillPaidOrder(num);
            return {
              orderNumber: num,
              action: "retry_topup",
              status: result.success ? "DELIVERED" : "FAILED",
              success: result.success,
              error: result.error,
            };
          }
        }

        if (order.status === "DELIVERED") {
          return {
            orderNumber: num,
            action: "none",
            status: "DELIVERED",
            success: true,
            message: "Already delivered",
          };
        }

        return {
          orderNumber: num,
          action: "none",
          status: order.status,
          success: false,
          message: `No API action available for status ${order.status}`,
        };
      } catch (err: any) {
        return {
          orderNumber: num,
          action: "error",
          status: "ERROR",
          success: false,
          error: err?.message || String(err),
        };
      }
    }

    // Single order requested
    if (orderNumber) {
      const order = await prisma.order.findUnique({
        where: { orderNumber: String(orderNumber).toUpperCase() },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentRef: true,
          topupProviderRef: true,
          paidAt: true,
        },
      });

      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      const res = await processOrder(order);
      revalidateAdminChange("orders", { orderNumber: order.orderNumber });

      await writeAuditForAdmin(admin, req, {
        action: "order.call_api",
        targetType: "order",
        targetId: order.orderNumber,
        details: res,
      });

      return NextResponse.json({ ok: true, result: res });
    }

    // Bulk / All orders
    const where: any = {};
    if (Array.isArray(orderNumbers) && orderNumbers.length > 0) {
      where.orderNumber = { in: orderNumbers.map((n: string) => String(n).toUpperCase()) };
    } else if (status && status !== "ALL") {
      where.status = status === "COMPLETED" ? "DELIVERED" : status;
    } else {
      // "ALL" target: all actionable orders needing API calls (PAID, PENDING, PROCESSING)
      where.status = { in: ["PAID", "PENDING", "PROCESSING"] };
    }

    const orders = await prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentRef: true,
        topupProviderRef: true,
        paidAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Safe batch limit
    });

    if (orders.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No orders found matching the criteria",
        total: 0,
        results: [],
      });
    }

    const results: any[] = [];
    let paidAndFulfilled = 0;
    let fulfilled = 0;
    let refreshed = 0;
    let stillPending = 0;
    let failed = 0;
    let unchanged = 0;

    // Process orders sequentially or small batches to prevent supplier rate limits
    for (const order of orders) {
      const outcome = await processOrder(order);
      results.push(outcome);

      if (outcome.status === "PAID_AND_FULFILLED") paidAndFulfilled++;
      else if (outcome.status === "DELIVERED" && outcome.success) fulfilled++;
      else if (outcome.status === "REFRESHED") refreshed++;
      else if (outcome.status === "PENDING") stillPending++;
      else if (!outcome.success && outcome.status !== "PENDING") failed++;
      else unchanged++;
    }

    await writeAuditForAdmin(admin, req, {
      action: "orders.bulk_call_api",
      targetType: "order",
      details: {
        filter: status,
        total: orders.length,
        paidAndFulfilled,
        fulfilled,
        refreshed,
        stillPending,
        failed,
      },
    });

    revalidateAdminChange("orders");

    return NextResponse.json({
      ok: true,
      total: orders.length,
      stats: {
        total: orders.length,
        paidAndFulfilled,
        fulfilled,
        refreshed,
        stillPending,
        failed,
        unchanged,
      },
      results,
    });
  },
  { permission: "orders.update" }
);
