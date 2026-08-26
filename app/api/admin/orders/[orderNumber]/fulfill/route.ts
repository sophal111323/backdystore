import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { fulfillPaidOrder } from "@/lib/fulfillment";
import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";

export const dynamic = "force-dynamic";

export const POST = withAdminAuth(
  async (req, { params }: { params: Promise<{ orderNumber: string }> }, admin) => {
    const { orderNumber } = await params;
    const normalizedOrderNumber = orderNumber.toUpperCase();

    const result = await fulfillPaidOrder(normalizedOrderNumber);

    await writeAuditForAdmin(admin, req, {
      action: "order.retry_auto_topup",
      targetType: "order",
      targetId: normalizedOrderNumber,
      details: result,
    });

    revalidateAdminChange("orders", { orderNumber: normalizedOrderNumber });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  },
  { permission: "orders.update" }
);
