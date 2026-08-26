import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDailyDashboardStats, getPreviousCambodiaDayRange } from "@/lib/dailyStats";
import { escapeHtml, notifyTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function line(value: string | null | undefined) {
  return escapeHtml(value || "-");
}

function paidOrderText(order: any, index: number) {
  const pkg = order.product.bonus > 0
    ? `${order.product.name} (${order.product.amount}+${order.product.bonus})`
    : order.product.name;

  return [
    `${index + 1}. <b>${line(order.game.name)}</b>`,
    `Order: <code>${line(order.orderNumber)}</code>`,
    `IP: <code>${line(order.ipAddress || "unknown")}</code>`,
    `ID: <code>${line(order.playerUid)}</code>`,
    `Package: ${line(pkg)}`,
    `Amount: <b>${money(order.amountUsd)}</b>`,
    `Status: ${line(order.status)}`,
  ].join("\n");
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-cron-secret") || "";

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}` && headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const range = getPreviousCambodiaDayRange();
  const targetId = range.label;

  if (!force) {
    const alreadySent = await prisma.auditLog.findFirst({
      where: {
        action: "telegram_daily_report_sent",
        targetType: "daily_report",
        targetId,
      },
    });

    if (alreadySent) {
      return NextResponse.json({ ok: true, skipped: true, reason: "already_sent", date: targetId });
    }
  }

  const stats = await getDailyDashboardStats(range);

  const cf = stats.cloudflareSecurity;
  const messages: string[] = [
    [
      `📊 <b>JASMINTOPUP Daily Report</b>`,
      `Date: <b>${line(stats.range.label)}</b> (Cambodia)`,
      "",
      `Origin requests: <b>${stats.totalRequests}</b>`,
      `Unique origin IPs: <b>${stats.uniqueIps}</b>`,
      `Create order requests: <b>${stats.orderApiRequests}</b>`,
      `Orders created: <b>${stats.ordersCreated}</b>`,
      `KHQR generated: <b>${stats.khqrGenerated}</b>`,
      `Pending orders: <b>${stats.pendingOrders}</b>`,
      `Paid ready: <b>${stats.paidReadyCount}</b>`,
      `Paid revenue: <b>${money(stats.paidRevenueUsd)}</b>`,
      "",
      `🛡️ <b>Cloudflare Protection</b>`,
      cf.enabled
        ? `Security events: <b>${cf.totalSecurityEvents}</b>\nProtected: <b>${cf.protectedEvents}</b>\nBlocked: <b>${cf.blockedEvents}</b>\nChallenged: <b>${cf.challengeEvents}</b>\nBot-related: <b>${cf.botEvents}</b>\nDDoS/rate-limit: <b>${cf.ddosEvents}</b>`
        : `Not configured: ${line(cf.error)}`,
    ].join("\n"),
  ];

  if (cf.enabled) {
    const actionLines = cf.topActions
      .slice(0, 8)
      .map((item, index) => `${index + 1}. ${line(item.label)} — <b>${item.count}</b>`)
      .join("\n");
    const ipLines = cf.topIps
      .slice(0, 8)
      .map((item, index) => `${index + 1}. <code>${line(item.ip || item.label)}</code> ${line(item.country || "")} — <b>${item.count}</b>`)
      .join("\n");

    messages.push(
      [
        `🛡️ <b>Cloudflare Top Security</b>`,
        "",
        `<b>Top actions</b>`,
        actionLines || "No actions",
        "",
        `<b>Top IPs</b>`,
        ipLines || "No IPs",
      ].join("\n")
    );
  }

  if (stats.paidOrders.length === 0) {
    messages.push(`✅ <b>Paid Ready Details</b>\nNo paid ready orders for ${line(stats.range.label)}.`);
  } else {
    const chunkSize = 8;
    for (let i = 0; i < stats.paidOrders.length; i += chunkSize) {
      const chunk = stats.paidOrders.slice(i, i + chunkSize);
      messages.push(
        [
          `✅ <b>Paid Ready Details</b> (${i + 1}-${i + chunk.length}/${stats.paidOrders.length})`,
          "",
          chunk.map((order, offset) => paidOrderText(order, i + offset)).join("\n\n"),
        ].join("\n")
      );
    }
  }

  let sent = true;
  for (const message of messages) {
    const ok = await notifyTelegram(message);
    if (!ok) sent = false;
  }

  await prisma.auditLog.create({
    data: {
      action: sent ? "telegram_daily_report_sent" : "telegram_daily_report_failed",
      targetType: "daily_report",
      targetId,
      details: JSON.stringify({
        totalRequests: stats.totalRequests,
        ordersCreated: stats.ordersCreated,
        khqrGenerated: stats.khqrGenerated,
        paidReadyCount: stats.paidReadyCount,
        paidRevenueUsd: stats.paidRevenueUsd,
        cloudflareSecurityEvents: stats.cloudflareSecurity.totalSecurityEvents,
        cloudflareProtectedEvents: stats.cloudflareSecurity.protectedEvents,
        cloudflareBlockedEvents: stats.cloudflareSecurity.blockedEvents,
        cloudflareChallengeEvents: stats.cloudflareSecurity.challengeEvents,
        cloudflareBotEvents: stats.cloudflareSecurity.botEvents,
        cloudflareDdosEvents: stats.cloudflareSecurity.ddosEvents,
      }),
    },
  });

  return NextResponse.json({ ok: sent, date: targetId, sent, messages: messages.length });
}
