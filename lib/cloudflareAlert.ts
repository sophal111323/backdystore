import { prisma } from "@/lib/prisma";
import { getCloudflareSecurityStats, type CloudflareSecurityStats } from "@/lib/cloudflareStats";
import { escapeHtml, notifyTelegram } from "@/lib/telegram";
import type { DayRange } from "@/lib/dailyStats";

export type CloudflareAlertMetric = "protected" | "blocked" | "bot" | "ddos" | "security";

export type CloudflareAlertResult = {
  ok: boolean;
  enabled: boolean;
  sent: boolean;
  test: boolean;
  rangeLabel: string;
  metric: CloudflareAlertMetric;
  currentCount: number;
  crossedThresholds: number[];
  newThresholds: number[];
  highestNewThreshold: number | null;
  error?: string;
};

const DEFAULT_THRESHOLDS = [
  1_000,
  10_000,
  20_000,
  50_000,
  100_000,
  200_000,
  500_000,
  1_000_000,
  2_000_000,
  5_000_000,
  10_000_000,
  20_000_000,
];

function envMetric(): CloudflareAlertMetric {
  const raw = String(process.env.CLOUDFLARE_ALERT_METRIC || "protected").toLowerCase().trim();
  if (["protected", "blocked", "bot", "ddos", "security"].includes(raw)) {
    return raw as CloudflareAlertMetric;
  }
  return "protected";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function parseThreshold(value: string): number | null {
  const clean = value.trim().toLowerCase().replace(/,/g, "");
  if (!clean) return null;

  const match = clean.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!match) return null;

  const num = Number(match[1]);
  const suffix = match[2];
  const multiplier = suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
  const result = Math.floor(num * multiplier);

  return Number.isFinite(result) && result > 0 ? result : null;
}

export function getCloudflareAlertThresholds(): number[] {
  const raw = process.env.CLOUDFLARE_ALERT_THRESHOLDS || "";
  const parsed = raw
    .split(",")
    .map(parseThreshold)
    .filter((value): value is number => typeof value === "number" && value > 0);

  const values = parsed.length > 0 ? parsed : DEFAULT_THRESHOLDS;
  return [...new Set(values)].sort((a, b) => a - b);
}

function metricLabel(metric: CloudflareAlertMetric): string {
  switch (metric) {
    case "blocked":
      return "Blocked events";
    case "bot":
      return "Bot-related events";
    case "ddos":
      return "DDoS / rate-limit events";
    case "security":
      return "All security events";
    default:
      return "Protected events";
  }
}

function metricCount(stats: CloudflareSecurityStats, metric: CloudflareAlertMetric): number {
  switch (metric) {
    case "blocked":
      return stats.blockedEvents;
    case "bot":
      return stats.botEvents;
    case "ddos":
      return stats.ddosEvents;
    case "security":
      return stats.totalSecurityEvents;
    default:
      return stats.protectedEvents;
  }
}

function targetId(range: DayRange, metric: CloudflareAlertMetric, threshold: number): string {
  return `${range.label}:${metric}:${threshold}`;
}

function line(value: string | null | undefined): string {
  return escapeHtml(value || "-");
}

function buildAlertMessage(
  range: DayRange,
  stats: CloudflareSecurityStats,
  metric: CloudflareAlertMetric,
  currentCount: number,
  newThresholds: number[],
  test: boolean
): string {
  const highestThreshold = newThresholds.length > 0 ? Math.max(...newThresholds) : 0;
  const actionLines = stats.topActions
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${line(item.label)} — <b>${formatNumber(item.count)}</b>`)
    .join("\n");
  const sourceLines = stats.topSources
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${line(item.label)} — <b>${formatNumber(item.count)}</b>`)
    .join("\n");
  const ipLines = stats.topIps
    .slice(0, 5)
    .map(
      (item, index) =>
        `${index + 1}. <code>${line(item.ip || item.label)}</code> ${line(item.country || "")} — <b>${formatNumber(item.count)}</b>`
    )
    .join("\n");
  const pathLines = stats.topPaths
    .slice(0, 5)
    .map((item, index) => `${index + 1}. <code>${line(item.path || item.label)}</code> — <b>${formatNumber(item.count)}</b>`)
    .join("\n");

  return [
    test ? "🧪 <b>Cloudflare Protection Alert Test</b>" : "🚨 <b>Cloudflare Protection Alert</b>",
    `Site: <b>JASMINTOPUP</b>`,
    `Date: <b>${line(range.label)}</b> (Cambodia)`,
    `Metric: <b>${line(metricLabel(metric))}</b>`,
    test ? `Current count: <b>${formatNumber(currentCount)}</b>` : `Reached: <b>${formatNumber(highestThreshold)}</b>+`,
    newThresholds.length > 0 ? `New crossed levels: <b>${newThresholds.map(formatNumber).join(", ")}</b>` : "New crossed levels: <b>test only</b>",
    "",
    `🛡️ <b>Cloudflare summary today</b>`,
    `Security events: <b>${formatNumber(stats.totalSecurityEvents)}</b>`,
    `Protected: <b>${formatNumber(stats.protectedEvents)}</b>`,
    `Blocked: <b>${formatNumber(stats.blockedEvents)}</b>`,
    `Challenged: <b>${formatNumber(stats.challengeEvents)}</b>`,
    `Bot-related: <b>${formatNumber(stats.botEvents)}</b>`,
    `DDoS/rate-limit: <b>${formatNumber(stats.ddosEvents)}</b>`,
    "",
    `<b>Top actions</b>`,
    actionLines || "No actions yet",
    "",
    `<b>Top sources</b>`,
    sourceLines || "No sources yet",
    "",
    `<b>Top IPs</b>`,
    ipLines || "No IPs yet",
    "",
    `<b>Top attacked paths</b>`,
    pathLines || "No paths yet",
  ].join("\n");
}

export async function checkCloudflareProtectionAlerts(
  range: DayRange,
  options: { force?: boolean; test?: boolean } = {}
): Promise<CloudflareAlertResult> {
  const metric = envMetric();
  const thresholds = getCloudflareAlertThresholds();
  const stats = await getCloudflareSecurityStats(range);

  if (!stats.enabled) {
    return {
      ok: false,
      enabled: false,
      sent: false,
      test: Boolean(options.test),
      rangeLabel: range.label,
      metric,
      currentCount: 0,
      crossedThresholds: [],
      newThresholds: [],
      highestNewThreshold: null,
      error: stats.error || "Cloudflare stats are not enabled",
    };
  }

  const currentCount = metricCount(stats, metric);
  const crossedThresholds = thresholds.filter((threshold) => currentCount >= threshold);

  if (options.test) {
    const message = buildAlertMessage(range, stats, metric, currentCount, [], true);
    const sent = await notifyTelegram(message);
    return {
      ok: sent,
      enabled: true,
      sent,
      test: true,
      rangeLabel: range.label,
      metric,
      currentCount,
      crossedThresholds,
      newThresholds: [],
      highestNewThreshold: null,
    };
  }

  if (crossedThresholds.length === 0) {
    return {
      ok: true,
      enabled: true,
      sent: false,
      test: false,
      rangeLabel: range.label,
      metric,
      currentCount,
      crossedThresholds,
      newThresholds: [],
      highestNewThreshold: null,
    };
  }

  let newThresholds = crossedThresholds;
  if (!options.force) {
    const ids = crossedThresholds.map((threshold) => targetId(range, metric, threshold));
    const existing = await prisma.auditLog.findMany({
      where: {
        action: "cloudflare_threshold_alert_sent",
        targetType: "cloudflare_alert",
        targetId: { in: ids },
      },
      select: { targetId: true },
    });
    const existingIds = new Set(existing.map((item) => item.targetId || ""));
    newThresholds = crossedThresholds.filter((threshold) => !existingIds.has(targetId(range, metric, threshold)));
  }

  if (newThresholds.length === 0) {
    return {
      ok: true,
      enabled: true,
      sent: false,
      test: false,
      rangeLabel: range.label,
      metric,
      currentCount,
      crossedThresholds,
      newThresholds: [],
      highestNewThreshold: null,
    };
  }

  const message = buildAlertMessage(range, stats, metric, currentCount, newThresholds, false);
  const sent = await notifyTelegram(message);

  if (sent) {
    await prisma.auditLog.createMany({
      data: newThresholds.map((threshold) => ({
        action: "cloudflare_threshold_alert_sent",
        targetType: "cloudflare_alert",
        targetId: targetId(range, metric, threshold),
        details: JSON.stringify({
          rangeLabel: range.label,
          metric,
          threshold,
          currentCount,
          totalSecurityEvents: stats.totalSecurityEvents,
          protectedEvents: stats.protectedEvents,
          blockedEvents: stats.blockedEvents,
          challengeEvents: stats.challengeEvents,
          botEvents: stats.botEvents,
          ddosEvents: stats.ddosEvents,
        }),
      })),
    });
  }

  return {
    ok: sent,
    enabled: true,
    sent,
    test: false,
    rangeLabel: range.label,
    metric,
    currentCount,
    crossedThresholds,
    newThresholds,
    highestNewThreshold: Math.max(...newThresholds),
  };
}
