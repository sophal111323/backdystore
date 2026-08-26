export type CloudflareSecurityRow = {
  label: string;
  count: number;
  action?: string | null;
  source?: string | null;
  ip?: string | null;
  country?: string | null;
  path?: string | null;
  datetime?: string | null;
  userAgent?: string | null;
};

export type CloudflareSecurityStats = {
  enabled: boolean;
  error?: string;
  rangeLabel: string;
  totalSecurityEvents: number;
  protectedEvents: number;
  blockedEvents: number;
  challengeEvents: number;
  botEvents: number;
  ddosEvents: number;
  topActions: CloudflareSecurityRow[];
  topSources: CloudflareSecurityRow[];
  topIps: CloudflareSecurityRow[];
  topPaths: CloudflareSecurityRow[];
  latestEvents: CloudflareSecurityRow[];
};

type RangeLike = {
  start: Date;
  end: Date;
  label: string;
};

type CfGroup = {
  count?: number;
  dimensions?: {
    action?: string | null;
    source?: string | null;
    clientIP?: string | null;
    clientCountryName?: string | null;
    clientRequestPath?: string | null;
  } | null;
};

type CfEvent = {
  action?: string | null;
  source?: string | null;
  clientIP?: string | null;
  clientCountryName?: string | null;
  clientRequestPath?: string | null;
  datetime?: string | null;
  userAgent?: string | null;
};

const PROTECTED_ACTIONS = new Set([
  "block",
  "managed_block",
  "managed_challenge",
  "challenge",
  "jschallenge",
  "connectionclose",
  "connection_close",
]);

const BLOCK_ACTIONS = new Set(["block", "managed_block", "connectionclose", "connection_close"]);
const CHALLENGE_ACTIONS = new Set(["managed_challenge", "challenge", "jschallenge"]);

function emptyStats(range: RangeLike, error?: string): CloudflareSecurityStats {
  return {
    enabled: false,
    error,
    rangeLabel: range.label,
    totalSecurityEvents: 0,
    protectedEvents: 0,
    blockedEvents: 0,
    challengeEvents: 0,
    botEvents: 0,
    ddosEvents: 0,
    topActions: [],
    topSources: [],
    topIps: [],
    topPaths: [],
    latestEvents: [],
  };
}

function normalize(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function isProtectedAction(action?: string | null): boolean {
  return PROTECTED_ACTIONS.has(normalize(action));
}

function isBlockAction(action?: string | null): boolean {
  return BLOCK_ACTIONS.has(normalize(action));
}

function isChallengeAction(action?: string | null): boolean {
  return CHALLENGE_ACTIONS.has(normalize(action));
}

function isBotSource(source?: string | null): boolean {
  const value = normalize(source);
  return value.includes("bot") || value === "bic" || value.includes("browserintegrity");
}

function isDdosSource(source?: string | null): boolean {
  const value = normalize(source);
  return value.includes("ddos") || value.includes("rate") || value.includes("ratelimit");
}

function groupLabel(action?: string | null, source?: string | null): string {
  const cleanAction = action || "unknown";
  const cleanSource = source || "unknown";
  return `${cleanAction} / ${cleanSource}`;
}

function aggregateByAction(groups: CfGroup[]): CloudflareSecurityRow[] {
  const map = new Map<string, number>();
  for (const group of groups) {
    const action = group.dimensions?.action || "unknown";
    map.set(action, (map.get(action) || 0) + (group.count || 0));
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, action: label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function aggregateBySource(groups: CfGroup[]): CloudflareSecurityRow[] {
  const map = new Map<string, number>();
  for (const group of groups) {
    const source = group.dimensions?.source || "unknown";
    map.set(source, (map.get(source) || 0) + (group.count || 0));
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, source: label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function topIpRows(groups: CfGroup[]): CloudflareSecurityRow[] {
  return groups.map((group) => ({
    label: group.dimensions?.clientIP || "unknown",
    ip: group.dimensions?.clientIP || "unknown",
    country: group.dimensions?.clientCountryName || null,
    count: group.count || 0,
  }));
}

function topPathRows(groups: CfGroup[]): CloudflareSecurityRow[] {
  return groups.map((group) => ({
    label: group.dimensions?.clientRequestPath || "/",
    path: group.dimensions?.clientRequestPath || "/",
    count: group.count || 0,
  }));
}

function latestEventRows(events: CfEvent[]): CloudflareSecurityRow[] {
  return events.map((event) => ({
    label: groupLabel(event.action, event.source),
    action: event.action || "unknown",
    source: event.source || "unknown",
    ip: event.clientIP || "unknown",
    country: event.clientCountryName || null,
    path: event.clientRequestPath || "/",
    datetime: event.datetime || null,
    userAgent: event.userAgent || null,
    count: 1,
  }));
}

function bearerToken(): string {
  return process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || "";
}

function zoneId(): string {
  return process.env.CLOUDFLARE_ZONE_ID || process.env.CF_ZONE_ID || "";
}

export async function getCloudflareSecurityStats(range: RangeLike): Promise<CloudflareSecurityStats> {
  const token = bearerToken();
  const zoneTag = zoneId();

  if (!token || !zoneTag) {
    return emptyStats(range, "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID");
  }

  const query = `
    query CloudflareSecurityOverview($zoneTag: string!, $start: Time!, $end: Time!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          total: firewallEventsAdaptiveGroups(
            limit: 1
            filter: { datetime_geq: $start, datetime_lt: $end }
          ) {
            count
          }
          byActionSource: firewallEventsAdaptiveGroups(
            limit: 50
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [count_DESC]
          ) {
            count
            dimensions {
              action
              source
            }
          }
          topIps: firewallEventsAdaptiveGroups(
            limit: 10
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [count_DESC]
          ) {
            count
            dimensions {
              clientIP
              clientCountryName
            }
          }
          topPaths: firewallEventsAdaptiveGroups(
            limit: 10
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [count_DESC]
          ) {
            count
            dimensions {
              clientRequestPath
            }
          }
          latest: firewallEventsAdaptive(
            limit: 10
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [datetime_DESC]
          ) {
            action
            source
            clientIP
            clientCountryName
            clientRequestPath
            datetime
            userAgent
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          zoneTag,
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        },
      }),
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return emptyStats(range, `Cloudflare API HTTP ${res.status}`);
    }

    if (json?.errors?.length) {
      const message = json.errors
        .map((error: { message?: string }) => error?.message)
        .filter(Boolean)
        .join(" | ");
      return emptyStats(range, message || "Cloudflare GraphQL error");
    }

    const zone = json?.data?.viewer?.zones?.[0];
    if (!zone) {
      return emptyStats(range, "Cloudflare zone not found or token has no Analytics Read permission");
    }

    const groups: CfGroup[] = Array.isArray(zone.byActionSource) ? zone.byActionSource : [];
    const topIps: CfGroup[] = Array.isArray(zone.topIps) ? zone.topIps : [];
    const topPaths: CfGroup[] = Array.isArray(zone.topPaths) ? zone.topPaths : [];
    const latest: CfEvent[] = Array.isArray(zone.latest) ? zone.latest : [];

    const totalSecurityEvents = Number(zone.total?.[0]?.count || 0);
    const protectedEvents = groups.reduce(
      (sum, group) => sum + (isProtectedAction(group.dimensions?.action) ? group.count || 0 : 0),
      0
    );
    const blockedEvents = groups.reduce(
      (sum, group) => sum + (isBlockAction(group.dimensions?.action) ? group.count || 0 : 0),
      0
    );
    const challengeEvents = groups.reduce(
      (sum, group) => sum + (isChallengeAction(group.dimensions?.action) ? group.count || 0 : 0),
      0
    );
    const botEvents = groups.reduce(
      (sum, group) => sum + (isBotSource(group.dimensions?.source) ? group.count || 0 : 0),
      0
    );
    const ddosEvents = groups.reduce(
      (sum, group) => sum + (isDdosSource(group.dimensions?.source) ? group.count || 0 : 0),
      0
    );

    return {
      enabled: true,
      rangeLabel: range.label,
      totalSecurityEvents,
      protectedEvents,
      blockedEvents,
      challengeEvents,
      botEvents,
      ddosEvents,
      topActions: aggregateByAction(groups),
      topSources: aggregateBySource(groups),
      topIps: topIpRows(topIps),
      topPaths: topPathRows(topPaths),
      latestEvents: latestEventRows(latest),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Cloudflare API error";
    return emptyStats(range, message);
  }
}
