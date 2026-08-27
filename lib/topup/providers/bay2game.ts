// lib/topup/providers/bay2game.ts
//
// Bay2Game game top-up adapter.
// Implemented strictly against the official documentation at
// https://bay2game.xyz/developer_docs/ :
//
//   Base URL:   https://api.bay2game.xyz/api
//   Auth:       api_key parameter on EVERY endpoint (from @Bay2GameBot /profile)
//
//   GET /profile                 → {status:"SUCCESS", user:{balance,...}}
//   GET /categories              → {status:"SUCCESS", categories:[{game_code,
//                                  name, image_url, game_fields:[...]}]}
//   GET /products                ?game_code= → {status:"SUCCESS",
//                                  products:[{id, product_code, name,
//                                  sell_price, status}]}
//   GET|POST /create_order       api_key, product_code, game_user_id,
//                                reference (UNIQUE, required),
//                                game_zone_id (optional)
//                                → SUCCESS {status:"SUCCESS", reference,
//                                amount, balance_after, completed_at}
//                                → FAILED {status:"FAILED", message, reference}
//   GET /check_order             ?reference= → {status:"SUCCESS",
//                                  order:{transaction_id, product_code,
//                                  status:"success"|"failed", ...}}
//
// Key documented rules:
//   • Reference MUST be unique → we always use our order number.
//   • Top-up is processed instantly.
//   • Order status values are "success" and "failed".
//   • There is NO webhook/callback system — use check_order polling.
//   • create_order supports both GET and POST; we use POST so the player ID
//     and reference stay out of access logs.

import type {
  TopupSupplier,
  TopupBalanceResult,
  TopUpRequest,
  TopUpResult,
  TopUpStatusResult,
} from "../types";

function cleanEnv(value?: string): string {
  return (value || "").trim().replace(/^['"]|['"]$/g, "");
}

const BAY2GAME_BASE =
  cleanEnv(process.env.BAY2GAME_BASE_URL) || "https://api.bay2game.xyz/api";

const TIMEOUT_MS = 20_000;

export class Bay2GameConfigError extends Error {
  constructor() {
    super(
      "BAY2GAME_API_KEY is not configured. Set it in the environment to enable auto top-up."
    );
    this.name = "Bay2GameConfigError";
  }
}

/** Never log the API key — params objects passed here may contain it. */
function redactParams(params: Record<string, string>): Record<string, string> {
  const out = { ...params };
  if ("api_key" in out) out.api_key = "[REDACTED]";
  return out;
}

async function callBay2Game(
  endpoint: string,
  params: Record<string, string>
): Promise<{ ok: boolean; status: number; data: any | null; networkError?: boolean }> {
  const apiKey = cleanEnv(process.env.BAY2GAME_API_KEY);
  if (!apiKey) throw new Bay2GameConfigError();

  const url = new URL(`${BAY2GAME_BASE}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        // api_key is sent as a query/body parameter per official docs.
        "User-Agent": "JASMINTOPUP/1.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    console.warn(
      `[bay2game] ${endpoint} ${isAbort ? "timed out" : "network error"}`,
      redactParams(params)
    );
    return { ok: false, status: 0, data: null, networkError: true };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalize a documented Bay2Game order status into:
 * "success" | "failed" | "pending" | "unknown"
 *
 * Documented values: "success", "failed". Anything else is treated as
 * still pending (never as success).
 */
export function normalizeBay2GameStatus(
  value: unknown
): "success" | "failed" | "pending" | "unknown" {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "success") return "success";
  if (raw === "failed") return "failed";
  if (raw === "" || raw === "pending" || raw === "processing") return "pending";

  return "unknown";
}

/**
 * Merchant profile / balance.
 * GET /profile
 */
export async function getBalance(): Promise<{
  success: boolean;
  balance?: number;
  currency: "USD";
  username?: string;
  totalOrders?: number;
  totalSpent?: number;
  error?: string;
}> {
  try {
    const res = await callBay2Game("/profile", {
      api_key: cleanEnv(process.env.BAY2GAME_API_KEY),
    });

    if (res.networkError || !res.data) {
      return { success: false, currency: "USD", error: "Network error contacting Bay2Game" };
    }

    if (
      String(res.data?.status ?? "").toLowerCase() === "success" &&
      res.data.user
    ) {
      return {
        success: true,
        balance: Number(res.data.user.balance) || 0,
        currency: "USD",
        username: res.data.user.username,
        totalOrders: Number(res.data.user.total_orders) || 0,
        totalSpent: Number(res.data.user.total_spent) || 0,
      };
    }

    return {
      success: false,
      currency: "USD",
      error: String(res.data?.message || `HTTP ${res.status}`),
    };
  } catch (err) {
    if (err instanceof Bay2GameConfigError) {
      return { success: false, currency: "USD", error: err.message };
    }
    return { success: false, currency: "USD", error: "Unexpected error" };
  }
}

/**
 * All active game categories (with per-game required fields).
 * GET /categories
 */
export async function getCategories(): Promise<{
  success: boolean;
  categories?: Array<{
    gameCode: string;
    name: string;
    description?: string;
    imageUrl?: string;
    fields: string[];
  }>;
  error?: string;
}> {
  try {
    const res = await callBay2Game("/categories", {
      api_key: cleanEnv(process.env.BAY2GAME_API_KEY),
    });

    if (res.networkError || !res.data) {
      return { success: false, error: "Network error contacting Bay2Game" };
    }

    if (
      String(res.data?.status ?? "").toLowerCase() === "success" &&
      Array.isArray(res.data.categories)
    ) {
      return {
        success: true,
        categories: res.data.categories.map((c: any) => ({
          gameCode: String(c.game_code ?? ""),
          name: String(c.name ?? ""),
          description: c.description ? String(c.description) : undefined,
          imageUrl: c.image_url ? String(c.image_url) : undefined,
          fields: Array.isArray(c.game_fields) ? c.game_fields.map(String) : [],
        })),
      };
    }

    return { success: false, error: String(res.data?.message || `HTTP ${res.status}`) };
  } catch (err) {
    if (err instanceof Bay2GameConfigError) return { success: false, error: err.message };
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Products/packages for a game.
 * GET /products?game_code=
 */
export async function getProducts(gameCode: string): Promise<{
  success: boolean;
  products?: Array<{
    id: number;
    productCode: string;
    name: string;
    sellPrice: number;
    active: boolean;
  }>;
  error?: string;
}> {
  try {
    const res = await callBay2Game("/products", {
      api_key: cleanEnv(process.env.BAY2GAME_API_KEY),
      game_code: gameCode,
    });

    if (res.networkError || !res.data) {
      return { success: false, error: "Network error contacting Bay2Game" };
    }

    if (
      String(res.data?.status ?? "").toLowerCase() === "success" &&
      Array.isArray(res.data.products)
    ) {
      return {
        success: true,
        products: res.data.products.map((p: any) => ({
          id: Number(p.id) || 0,
          productCode: String(p.product_code ?? ""),
          name: String(p.name ?? ""),
          sellPrice: Number(p.sell_price) || 0,
          active: String(p.status ?? "").toLowerCase() === "active",
        })),
      };
    }

    return { success: false, error: String(res.data?.message || `HTTP ${res.status}`) };
  } catch (err) {
    if (err instanceof Bay2GameConfigError) return { success: false, error: err.message };
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Create a game top-up.
 * POST /create_order
 *
 * IDEMPOTENCY: `reference` MUST be unique per top-up. We always pass the
 * internal order number, so the same order can never create two different
 * provider transactions with different references.
 *
 * On network timeout the outcome at Bay2Game is UNKNOWN — the caller must
 * check getTopupStatus(reference) before ever creating a new top-up.
 */
export async function createTopup(req: TopUpRequest): Promise<TopUpResult> {
  try {
    const params: Record<string, string> = {
      api_key: cleanEnv(process.env.BAY2GAME_API_KEY),
      product_code: req.productCode,
      game_user_id: req.userId,
      reference: req.reference,
    };
    if (req.zoneId && req.zoneId.trim()) {
      params.game_zone_id = req.zoneId.trim();
    }

    const url = new URL(`${BAY2GAME_BASE}/create_order`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      // Docs: create_order supports GET and POST. We use POST with the
      // parameters in an application/x-www-form-urlencoded BODY.
      // NOTE: Bay2Game's POST handler reads the body — passing the params
      // only in the query string makes it reject with
      // "api_key, product_code, and game_user_id are required".
      res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      console.warn(
        `[bay2game] create_order ${isAbort ? "timed out" : "network error"}`,
        redactParams(params)
      );
      return {
        success: false,
        unknown: true,
        error: isAbort
          ? "Bay2Game timed out — outcome unknown"
          : "Network error contacting Bay2Game",
      };
    } finally {
      clearTimeout(timer);
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    console.log(
      `[bay2game] create_order ref=${req.reference} http=${res.status} providerStatus=${data?.status ?? "?"}`
    );

    // The live API returns lowercase statuses ("success" / "failed") even
    // though the docs show uppercase. Compare case-insensitively.
    const providerStatus = String(data?.status ?? "").trim().toLowerCase();

    if (providerStatus === "success") {
      return {
        success: true,
        transactionId: String(data.reference ?? req.reference),
        status: normalizeBay2GameStatus("success"),
        rawResponse: data,
      };
    }

    if (providerStatus === "failed") {
      // Documented failure example: insufficient balance.
      return {
        success: false,
        error: String(data.message || "Top-up failed"),
        rawResponse: data,
      };
    }

    // status === "ERROR" or unexpected payload.
    return {
      success: false,
      error: String(data?.message || `HTTP ${res.status}`),
      rawResponse: data,
    };
  } catch (err) {
    if (err instanceof Bay2GameConfigError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "Unexpected error creating top-up" };
  }
}

/**
 * Check a top-up by reference.
 * GET /check_order?reference=
 */
export async function getTopupStatus(
  reference: string
): Promise<TopUpStatusResult> {
  try {
    const res = await callBay2Game("/check_order", {
      api_key: cleanEnv(process.env.BAY2GAME_API_KEY),
      reference,
    });

    if (res.networkError || !res.data) {
      return { found: false, status: "unknown", error: "Network error contacting Bay2Game" };
    }

    if (
      String(res.data?.status ?? "").toLowerCase() === "success" &&
      res.data.order
    ) {
      const order = res.data.order;
      return {
        found: true,
        status: normalizeBay2GameStatus(order.status),
        transactionId: String(order.transaction_id ?? reference),
        productName: order.product_name ? String(order.product_name) : undefined,
        amount: typeof order.amount !== "undefined" ? Number(order.amount) : undefined,
        rawResponse: res.data,
      };
    }

    return {
      found: false,
      status: "unknown",
      error: String(res.data?.message || `HTTP ${res.status}`),
      rawResponse: res.data,
    };
  } catch (err) {
    if (err instanceof Bay2GameConfigError) {
      return { found: false, status: "unknown", error: err.message };
    }
    return { found: false, status: "unknown", error: "Unexpected error checking status" };
  }
}

export class Bay2GameSupplier implements TopupSupplier {
  readonly name = "bay2game" as const;
  readonly displayName = "Bay2Game";

  async createOrder(params: {
    productCode: string;
    playerId: string;
    serverId?: string;
    orderReference: string;
  }): Promise<TopUpResult> {
    return createTopup({
      reference: params.orderReference,
      productCode: params.productCode,
      userId: params.playerId,
      zoneId: params.serverId,
      supplier: "bay2game",
    });
  }

  async checkOrder(referenceOrOrderCode: string): Promise<TopUpStatusResult> {
    return getTopupStatus(referenceOrOrderCode);
  }

  async getBalance(): Promise<TopupBalanceResult> {
    return getBalance();
  }

  async getCategories() {
    return getCategories();
  }

  async getProducts(gameCode: string) {
    return getProducts(gameCode);
  }
}

export const bay2gameSupplier = new Bay2GameSupplier();




