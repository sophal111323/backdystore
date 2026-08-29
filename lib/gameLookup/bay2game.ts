/**
 * lib/gameLookup/bay2game.ts
 *
 * Bay2Game Game ID Validation & Player Lookup Provider
 * Documentation: https://bay2game.xyz/developer_docs/validation-check/
 *
 * Features:
 * - Real-time Player ID checking across supported games (MLBB, Free Fire, PUBG Mobile, Blood Strike, Honor of Kings)
 * - Converts internal game slug into verified Bay2Game game code
 * - Validates Server/Zone ID requirements
 * - Applies AbortController timeout protection (10s)
 * - Preserves Roblox official user lookup API separately
 * - Extracts username, region, game title, and normalized status
 */

export type SupportedGameSlug =
  | "mobile-legends"
  | "mlbb"
  | "free-fire"
  | "ff-global"
  | "freefire"
  | "pubg-mobile"
  | "pubgm"
  | "blood-strike"
  | "bloodstrike"
  | "honor-of-king"
  | "honor-of-kings"
  | "hok"
  | "ro-blox"
  | "roblox";

export type GameLookupConfig = {
  bay2GameCode?: string;
  needsServer: boolean;
  useRoblox?: boolean;
  gameTitle: string;
};

export const GAME_LOOKUP_CONFIG: Record<string, GameLookupConfig> = {
  // Mobile Legends (Bang Bang) — requires server/zone id
  "mobile-legends": {
    bay2GameCode: "mlbb",
    needsServer: true,
    gameTitle: "Mobile Legends: Bang Bang",
  },
  "mlbb": {
    bay2GameCode: "mlbb",
    needsServer: true,
    gameTitle: "Mobile Legends: Bang Bang",
  },

  // Garena Free Fire — no server/zone id needed
  "free-fire": {
    bay2GameCode: "freefire_sgmy",
    needsServer: false,
    gameTitle: "Garena Free Fire",
  },
  "ff-global": {
    bay2GameCode: "freefire_sgmy",
    needsServer: false,
    gameTitle: "Garena Free Fire",
  },
  "freefire": {
    bay2GameCode: "freefire_sgmy",
    needsServer: false,
    gameTitle: "Garena Free Fire",
  },

  // PUBG Mobile — no server/zone id needed
  "pubg-mobile": {
    bay2GameCode: "pubgm",
    needsServer: false,
    gameTitle: "PUBG Mobile",
  },
  "pubgm": {
    bay2GameCode: "pubgm",
    needsServer: false,
    gameTitle: "PUBG Mobile",
  },

  // Blood Strike — no server/zone id needed
  "blood-strike": {
    bay2GameCode: "bloodstrike",
    needsServer: false,
    gameTitle: "Blood Strike",
  },
  "bloodstrike": {
    bay2GameCode: "bloodstrike",
    needsServer: false,
    gameTitle: "Blood Strike",
  },

  // Honor of Kings — no server/zone id needed
  "honor-of-king": {
    bay2GameCode: "hok",
    needsServer: false,
    gameTitle: "Honor of Kings",
  },
  "honor-of-kings": {
    bay2GameCode: "hok",
    needsServer: false,
    gameTitle: "Honor of Kings",
  },
  "hok": {
    bay2GameCode: "hok",
    needsServer: false,
    gameTitle: "Honor of Kings",
  },

  // Roblox — preserved separately using official Roblox API
  "ro-blox": {
    needsServer: false,
    useRoblox: true,
    gameTitle: "Roblox",
  },
  "roblox": {
    needsServer: false,
    useRoblox: true,
    gameTitle: "Roblox",
  },
};

export function getGameLookupConfig(gameSlug: string): GameLookupConfig | null {
  if (!gameSlug || typeof gameSlug !== "string") return null;
  const normalized = gameSlug.trim().toLowerCase();
  return GAME_LOOKUP_CONFIG[normalized] ?? null;
}

export type GameLookupResult = {
  success: boolean;
  username: string | null;
  region?: string | null;
  game?: string | null;
  error?: string;
};

interface Bay2GameCheckIdResponse {
  status?: string;
  message?: string;
  username?: string | null;
  region?: string | null;
  game_title?: string | null;
  timestamp?: string;
  developer?: string;
}

const BAY2GAME_CHECKID_BASE = (
  process.env.BAY2GAME_CHECKID_BASE_URL || "https://checkid.bay2game.xyz"
)
  .trim()
  .replace(/\/+$/, "");

/**
 * Official Roblox API lookup for User ID validation
 */
async function lookupRoblox(uid: string): Promise<GameLookupResult> {
  const cleanUid = uid.trim();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    const res = await fetch(
      `https://users.roblox.com/v1/users/${encodeURIComponent(cleanUid)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "DYTOPUP/1.0",
        },
        cache: "no-store",
        signal: controller.signal,
      }
    );

    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        username: null,
        error: "Player not found — check your ID",
      };
    }

    const data = (await res.json().catch(() => null)) as {
      name?: unknown;
      displayName?: unknown;
    } | null;

    const nickname =
      typeof data?.name === "string" && data.name.trim().length > 0
        ? data.name.trim()
        : typeof data?.displayName === "string" && data.displayName.trim().length > 0
        ? data.displayName.trim()
        : null;

    if (!nickname || nickname.toLowerCase() === cleanUid.toLowerCase()) {
      return {
        success: false,
        username: null,
        error: "Player not found — check your ID",
      };
    }

    return {
      success: true,
      username: nickname,
      game: "Roblox",
    };
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
    return {
      success: false,
      username: null,
      error: isTimeout
        ? "ID check timed out. Please try again."
        : "Unable to validate player ID. Please try again.",
    };
  }
}

/**
 * Validates a Player ID and returns nickname, region, and game title using Bay2Game ID Checker API.
 *
 * @param gameSlug Internal game slug (e.g., "mobile-legends", "free-fire", "pubg-mobile")
 * @param uid Player User ID
 * @param serverId Optional Server/Zone ID (required for games like Mobile Legends)
 */
export async function lookupBay2GameNickname(
  gameSlug: string,
  uid: string,
  serverId?: string
): Promise<GameLookupResult> {
  const cleanSlug = (gameSlug || "").trim().toLowerCase();
  const cleanUid = (uid || "").trim();
  const cleanServerId = (serverId || "").trim();

  const cfg = getGameLookupConfig(cleanSlug);
  if (!cfg) {
    return {
      success: false,
      username: null,
      error: "Unsupported game",
    };
  }

  // Roblox uses official Roblox API
  if (cfg.useRoblox) {
    return lookupRoblox(cleanUid);
  }

  if (cfg.needsServer && !cleanServerId) {
    return {
      success: false,
      username: null,
      error: "Server ID is required",
    };
  }

  if (!cfg.bay2GameCode) {
    return {
      success: false,
      username: null,
      error: "Unsupported game",
    };
  }

  try {
    const url = new URL(`${BAY2GAME_CHECKID_BASE}/check_id`);
    url.searchParams.set("game", cfg.bay2GameCode);
    url.searchParams.set("userid", cleanUid);
    if (cfg.needsServer && cleanServerId) {
      url.searchParams.set("serverid", cleanServerId);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "DYTOPUP/1.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        username: null,
        error: "Unable to validate player ID. Please try again.",
      };
    }

    const data = (await res.json().catch(() => null)) as Bay2GameCheckIdResponse | null;

    if (!data || typeof data !== "object") {
      return {
        success: false,
        username: null,
        error: "Unable to validate player ID. Please try again.",
      };
    }

    // Success response verification
    if (
      data.status === "APPROVED" &&
      typeof data.username === "string" &&
      data.username.trim().length > 0
    ) {
      const username = data.username.trim();

      // If upstream returns empty or echoes the UID back
      if (username.toLowerCase() === cleanUid.toLowerCase()) {
        return {
          success: false,
          username: null,
          error: "Player not found — check your ID",
        };
      }

      return {
        success: true,
        username,
        region: typeof data.region === "string" && data.region.trim() ? data.region.trim() : null,
        game:
          typeof data.game_title === "string" && data.game_title.trim() && data.game_title !== "null"
            ? data.game_title.trim()
            : cfg.gameTitle,
      };
    }

    // Process error response messages
    const rawMessage = typeof data.message === "string" ? data.message.toLowerCase() : "";
    let errorMessage = "Player not found — check your ID";

    if (rawMessage.includes("not support region")) {
      errorMessage = "Not supported in this region";
    } else if (rawMessage.includes("invalid game code") || rawMessage.includes("game is inactive")) {
      errorMessage = "Unsupported game";
    } else if (rawMessage.includes("user not found") || rawMessage.includes("invalid")) {
      errorMessage = "Player not found — check your ID";
    }

    return {
      success: false,
      username: null,
      error: errorMessage,
    };
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
    return {
      success: false,
      username: null,
      error: isTimeout
        ? "ID check timed out. Please try again."
        : "Unable to validate player ID. Please try again.",
    };
  }
}

/**
 * Backward-compatible helper returning username or null
 */
export async function lookupGameNickname(
  gameSlug: string,
  uid: string,
  serverId?: string
): Promise<string | null> {
  const result = await lookupBay2GameNickname(gameSlug, uid, serverId);
  return result.success ? result.username : null;
}

