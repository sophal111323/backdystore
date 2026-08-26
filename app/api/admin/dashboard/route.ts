import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";

const paidLikeStatuses = ["PAID", "PROCESSING", "DELIVERED"];

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const GET = withAdminAuth(
  async () => {
    const today = startOfToday();

    const [
      totalOrders,
      statusGroups,
      todayRevenue,
      newOrdersToday,
      totalGames,
      activeGames,
      totalProducts,
      activeProducts,
      recentOrders,
      unreadNotifications,
      customersRaw,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: {
          status: { in: paidLikeStatuses },
          createdAt: { gte: today },
        },
        _sum: { amountUsd: true, amountKhr: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.game.count(),
      prisma.game.count({ where: { active: true } }),
      prisma.product.count(),
      prisma.product.count({ where: { active: true } }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          game: { select: { id: true, name: true, slug: true } },
          product: { select: { id: true, name: true } },
        },
      }),
      prisma.notification.count({ where: { readAt: null } }).catch(() => 0),
      prisma.order.findMany({
        take: 5000,
        orderBy: { createdAt: "desc" },
        select: { customerEmail: true, customerPhone: true, playerUid: true },
      }),
    ]);

    const statusCounts = statusGroups.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {});

    const customerKeys = new Set<string>();
    for (const order of customersRaw) {
      const key = order.customerEmail || order.customerPhone || `uid:${order.playerUid}`;
      if (key) customerKeys.add(key);
    }

    return NextResponse.json({
      stats: {
        totalOrders,
        pendingOrders: statusCounts.PENDING || 0,
        paidOrders: statusCounts.PAID || 0,
        processingOrders: statusCounts.PROCESSING || 0,
        completedOrders: statusCounts.DELIVERED || 0,
        failedOrders: statusCounts.FAILED || 0,
        cancelledOrders: statusCounts.CANCELLED || 0,
        refundedOrders: statusCounts.REFUNDED || 0,
        todayRevenueUsd: Math.round((todayRevenue._sum.amountUsd || 0) * 100) / 100,
        todayRevenueKhr: Math.round((todayRevenue._sum.amountKhr || 0) * 100) / 100,
        totalCustomers: customerKeys.size,
        newOrdersToday,
        totalGames,
        activeGames,
        totalProducts,
        activeProducts,
        unreadNotifications,
      },
      recentOrders,
      systemStatus: {
        database: "ok",
        api: "ok",
        auth: "ok",
      },
    });
  },
  { permission: "dashboard.read" }
);
