import { prisma } from "@/lib/prisma";
import { getCloudflareSecurityStats } from "@/lib/cloudflareStats";

const KH_TIME_OFFSET_MS = 7 * 60 * 60 * 1000;
const PAID_STATUSES = ["PAID", "PROCESSING", "DELIVERED"];

export type DayRange = {
  start: Date;
  end: Date;
  label: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function getCambodiaDayRange(date = new Date()): DayRange {
  const khDate = new Date(date.getTime() + KH_TIME_OFFSET_MS);
  const y = khDate.getUTCFullYear();
  const m = khDate.getUTCMonth();
  const d = khDate.getUTCDate();

  const start = new Date(Date.UTC(y, m, d) - KH_TIME_OFFSET_MS);
  const end = new Date(Date.UTC(y, m, d + 1) - KH_TIME_OFFSET_MS);
  const label = `${y}-${pad(m + 1)}-${pad(d)}`;

  return { start, end, label };
}

export function getPreviousCambodiaDayRange(date = new Date()): DayRange {
  return getCambodiaDayRange(new Date(date.getTime() - 24 * 60 * 60 * 1000));
}

export async function getDailyDashboardStats(range: DayRange) {
  const whereToday = {
    createdAt: {
      gte: range.start,
      lt: range.end,
    },
  };

  const paidWhere = {
    paidAt: {
      gte: range.start,
      lt: range.end,
    },
    status: { in: PAID_STATUSES },
  };

  const cloudflareSecurityPromise = getCloudflareSecurityStats(range);

  const [
    totalRequests,
    uniqueIpRows,
    orderApiRequests,
    ordersCreated,
    khqrGenerated,
    pendingOrders,
    paidReadyCount,
    paidOrders,
    latestOrderRequests,
    latestRequests,
  ] = await Promise.all([
    prisma.requestLog.count({ where: whereToday }),
    prisma.requestLog.groupBy({
      by: ["ip"],
      where: whereToday,
      _count: { ip: true },
      orderBy: { _count: { ip: "desc" } },
    }),
    prisma.requestLog.count({
      where: {
        ...whereToday,
        path: { startsWith: "/api/orders" },
        method: "POST",
      },
    }),
    prisma.order.count({ where: whereToday }),
    prisma.order.count({
      where: {
        ...whereToday,
        OR: [
          { qrString: { not: null } },
          { paymentUrl: { not: null } },
          { paymentRef: { not: null } },
        ],
      },
    }),
    prisma.order.count({
      where: {
        ...whereToday,
        status: "PENDING",
      },
    }),
    prisma.order.count({ where: paidWhere }),
    prisma.order.findMany({
      where: paidWhere,
      include: {
        game: { select: { name: true, slug: true } },
        product: { select: { name: true, amount: true, bonus: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 50,
    }),
    prisma.order.findMany({
      where: whereToday,
      include: {
        game: { select: { name: true, slug: true } },
        product: { select: { name: true, amount: true, bonus: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.requestLog.findMany({
      where: whereToday,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const paidRevenueUsd = Math.round(
    paidOrders.reduce((sum, order) => sum + order.amountUsd, 0) * 100
  ) / 100;

  const cloudflareSecurity = await cloudflareSecurityPromise;

  return {
    range,
    totalRequests,
    uniqueIps: uniqueIpRows.length,
    topIps: uniqueIpRows
      .slice(0, 10)
      .map((row) => ({ ip: row.ip, count: row._count.ip })),
    orderApiRequests,
    ordersCreated,
    khqrGenerated,
    pendingOrders,
    paidReadyCount,
    paidRevenueUsd,
    cloudflareSecurity,
    paidOrders,
    latestOrderRequests,
    latestRequests,
  };
}
