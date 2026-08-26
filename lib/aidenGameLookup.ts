const AIDEN_API_BASE = "https://aiden-api.vercel.app/API";

export type SupportedGameSlug =
  | "free-fire"
  | "ff-global"
  | "blood-strike"
  | "pubg-mobile"
  | "pubgm"
  | "pubgm-lite"
  | "honor-of-king"
  | "honor-of-kings"
  | "mobile-legends"
  | "magic-chess"
  | "magic-chess-go"
  | "mcgg"
  | "ro-blox";

type GameLookupConfig = {
  apiName: string;
  needsZone: boolean;
  useRoblox?: boolean;
};

const GAME_LOOKUP_CONFIG: Record<string, GameLookupConfig> = {
  "free-fire": { apiName: "ff-global", needsZone: false },
  "ff-global": { apiName: "ff-global", needsZone: false },
  "blood-strike": { apiName: "blood-strike", needsZone: false },
  "pubg-mobile": { apiName: "pubgm", needsZone: false },
  "pubgm": { apiName: "pubgm", needsZone: false },
  "pubgm-lite": { apiName: "pubgm-lite", needsZone: false },
  "honor-of-king": { apiName: "honor-of-kings", needsZone: false },
  "honor-of-kings": { apiName: "honor-of-kings", needsZone: false },
  "mobile-legends": { apiName: "mobile-legends", needsZone: true },
  "magic-chess": { apiName: "mcgg", needsZone: true },
  "magic-chess-go": { apiName: "mcgg", needsZone: true },
  "mcgg": { apiName: "mcgg", needsZone: true },
  "ro-blox": { apiName: "roblox", needsZone: false, useRoblox: true },
};

export function getGameLookupConfig(gameSlug: string): GameLookupConfig | null {
  return GAME_LOOKUP_CONFIG[gameSlug] ?? null;
}

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function extractNicknameFromObject(data: Record<string, unknown>): string | null {
  const directFields = [
    "nickname",
    "name",
    "username",
    "userName",
    "playerName",
    "player_name",
    "ign",
    "nick",
  ];

  for (const field of directFields) {
    const value = getStringValue(data[field]);
    if (value) return value;
  }

  for (const nestedField of ["data", "result", "user", "player", "response"]) {
    const nested = data[nestedField];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const value = extractNicknameFromObject(nested as Record<string, unknown>);
      if (value) return value;
    }
  }

  return null;
}

function extractNickname(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return extractNicknameFromObject(data as Record<string, unknown>);
}

function sanitizeNickname(nickname: string | null, uid: string): string | null {
  if (!nickname) return null;

  const cleanName = nickname.trim();
  const cleanUid = uid.trim();

  if (!cleanName) return null;

  // Some lookup APIs echo the UID back when the player is not found.
  if (cleanName.toLowerCase() === cleanUid.toLowerCase()) return null;

  return cleanName;
}

async function lookupRoblox(uid: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    const res = await fetch(`https://users.roblox.com/v1/users/${encodeURIComponent(uid)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    const nickname = extractNickname(data);
    return sanitizeNickname(nickname, uid);
  } catch {
    return null;
  }
}

export async function lookupAidenGameNickname(
  gameSlug: string,
  uid: string,
  zone?: string,
): Promise<string | null> {
  const cfg = getGameLookupConfig(gameSlug);
  if (!cfg) return null;

  if (cfg.useRoblox) {
    return lookupRoblox(uid.trim());
  }

  if (cfg.needsZone && !zone?.trim()) {
    return null;
  }

  try {
    const url = new URL(`${AIDEN_API_BASE}/${cfg.apiName}`);
    url.searchParams.set("id", uid.trim());

    if (cfg.needsZone && zone?.trim()) {
      url.searchParams.set("zone", zone.trim());
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "JASMINTOPUP/1.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    const nickname = extractNickname(data);

    return sanitizeNickname(nickname, uid);
  } catch {
    return null;
  }
}
