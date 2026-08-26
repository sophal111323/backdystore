import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";

function normalizeStatus(value?: string | null) {
  if (!value || value === "ALL") return undefined;
  const upper = value.toUpperCase();
  return upper === "COMPLETED" ? "DELIVERED" : upper;
}

export const GET = withAdminAuth(
  async (req) => {
    const { searchParams } = req.nextUrl;
    const status = normalizeStatus(searchParams.get("status"));
    const q = searchParams.get("q")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "25", 10)));

    const where: any = {};
    if (status) where.status = status;
    if (q) {
      const qUpper = q.toUpperCase();
      where.OR = [
        { orderNumber: { contains: qUpper, mode: "insensitive" as const } },
        { playerUid: { contains: q, mode: "insensitive" as const } },
        { playerNickname: { contains: q, mode: "insensitive" as const } },
        { customerEmail: { contains: q, mode: "insensitive" as const } },
        { customerPhone: { contains: q, mode: "insensitive" as const } },
        { paymentRef: { contains: q, mode: "insensitive" as const } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          game: { select: { id: true, name: true, slug: true } },
          product: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    });
  },
  { permission: "orders.read" }
);
