// app/api/admin/orders/[orderNumber]/topup-status/route.ts
//
// Admin-only top-up status refresh.
// POST /api/admin/orders/[orderNumber]/topup-status
//
// Re-checks the EXISTING Bay2Game transaction via /check_order and updates
// the order. NEVER creates a new top-up — duplicate fulfillment is
// impossible through this endpoint.

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { writeAuditForAdmin } from "@/lib/audit";
import { refreshTopupStatus } from "@/lib/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAdminAuth(async (
  req,
  { params }: { params: Promise<{ orderNumber: string }> },
  admin
) => {
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, orderNumber: true, status: true, topupProviderRef: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!order.topupProviderRef) {
    return NextResponse.json(
      {
        error:
          "This order has no Bay2Game transaction. Auto top-up runs after payment; manual top-ups are handled outside the provider.",
      },
      { status: 400 }
    );
  }

  const result = await refreshTopupStatus(orderNumber);

  await writeAuditForAdmin(admin, req, {
    action: "order.topup_status_refresh",
    targetType: "order",
    targetId: order.id,
    details: {
      provider: "bay2game",
      reference: order.topupProviderRef,
      result,
    },
  });

  const updated = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      status: true,
      topupProvider: true,
      topupProviderRef: true,
      topupStatus: true,
      deliveryNote: true,
      failureReason: true,
    },
  });

  return NextResponse.json({
    ok: result.success,
    skipped: result.skipped ?? false,
    result,
    order: updated,
  });
});
