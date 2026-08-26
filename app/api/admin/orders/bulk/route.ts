import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { writeAuditForAdmin } from "@/lib/audit";
import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";

export const DELETE = withAdminAuth(
  async (req, _ctx, admin) => {
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "DELETE") {
      return NextResponse.json(
        { error: "Missing confirmation. Resend with { confirm: 'DELETE' }." },
        { status: 400 }
      );
    }

    const status = typeof body.status === "string" ? body.status : "ALL";
    const where = status === "ALL" ? undefined : { status: status === "COMPLETED" ? "DELIVERED" : status };

    const result = await prisma.order.deleteMany({ where });

    await writeAuditForAdmin(admin, req, {
      action: "orders.bulk_delete",
      targetType: "order",
      details: `Deleted ${result.count} orders (filter: ${status})`,
    });

    return NextResponse.json({ ok: true, deleted: result.count });
  },
  { roles: ["OWNER"] }
);
