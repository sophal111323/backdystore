// lib/topup/providers/frozenyuki.ts
//
// FrozenYuki / SoraTopup game top-up adapter.
// Implemented strictly against the official documentation at
// https://soratopup.com/api/v1 :
//
//   Base URL:   https://soratopup.com/api/v1
//   Auth:       Authorization: Bearer <API_KEY>
//   Headers:    Idempotency-Key: <UNIQUE_ORDER_REFERENCE>
//
//   POST /order                    { game: "GAME_CODE", code: "PACKAGE_CODE", fieldValues: ["VAL1", "VAL2"] }
//                                  → { ok: true, code: 0, msg: "success", refid: "API...", status: "Processing" }
//   GET  /order?ref=REFID          → { ok: true, code: 0, msg: "success", refid: "API...", status: "Success", ... }
//   GET  /balance                  → { ok: true, code: 0, msg: "success", balance: 42.50, currency: "USD" }
//   GET  /catalogue                → { ok: true, games: [ { id: "ff_my", code: "ff", name: "Free Fire", fields: [...] } ] }
//   GET  /packages?game=GAME_CODE  → { ok: true, game: "...", packages: [ { code: "100", name: "100 DM", price: 0.87 } ] }

import type {
  TopupSupplier,
  TopupBalanceResult,
  TopUpResult,
  TopUpStatusResult,
} from "../types";

function cleanEnv(value?: string): string {
  return (value || "").trim().replace(/^['"]|['"]$/g, "");
}

function getFrozenYukiBaseUrl(): string {
  let raw =
    cleanEnv(process.env.FROZENYUKI_BASE_URL) ||
    cleanEnv(process.env.FROZENYUKI_API_BASE_URL) ||
    cleanEnv(process.env.SORATOPUP_BASE_URL) ||
    "https://soratopup.com/api/v1";

  raw = raw.replace(/\/+$/, "");
  if (!raw.endsWith("/api/v1") && !raw.includes("/api/")) {
    raw += "/api/v1";
  }
  return raw;
}

const TIMEOUT_MS = 20_000;

export class FrozenYukiConfigError extends Error {
  constructor() {
    super(
      "FROZENYUKI_API_KEY is not configured. Set it in the environment to enable FrozenYuki / SoraTopup auto delivery."
    );
    this.name = "FrozenYukiConfigError";
  }
}

/** Redact sensitive info before logging */
function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out = { ...headers };
  if ("Authorization" in out) out.Authorization = "[REDACTED]";
  return out;
}

interface FrozenYukiApiResponse<T = any> {
  ok: boolean;
  code?: number;
  msg?: string;
  error?: string;
  refid?: string;
  status?: string;
  balance?: number;
  currency?: string;
  games?: Array<{
    id?: string;
    code?: string;
    name: string;
    fields?: string[];
  }>;
  packages?: Array<{
    code: string;
    name: string;
    price: number | string;
  }>;
  [key: string]: any;
}

async function callFrozenYuki(
  endpoint: string,
  options: {
    method: "GET" | "POST";
    body?: any;
    params?: Record<string, string>;
    idempotencyKey?: string;
  }
): Promise<{
  ok: boolean;
  status: number;
  data: FrozenYukiApiResponse | null;
  networkError?: boolean;
  isTimeout?: boolean;
}> {
  const apiKey =
    cleanEnv(process.env.FROZENYUKI_API_KEY) ||
    cleanEnv(process.env.SORATOPUP_API_KEY);
  if (!apiKey) throw new FrozenYukiConfigError();

  const baseUrl = getFrozenYukiBaseUrl();
  const url = new URL(
    `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  );

  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, v);
      }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "User-Agent": "DYTOPUP/1.0",
  };

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  if (options.body && options.method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(url.toString(), {
      method: options.method,
      headers,
      body:
        options.body && options.method === "POST"
          ? JSON.stringify(options.body)
          : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timer);

    const text = await res.text();
    let data: FrozenYukiApiResponse | null = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    return {
      ok: res.ok && Boolean(data?.ok),
      status: res.status,
      data,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("aborted"));

    console.error(
      `[frozenyuki] ${options.method} ${endpoint} ${
        isAbort ? "timed out" : "network error"
      }:`,
      err instanceof Error ? err.message : String(err)
    );

    return {
      ok: false,
      status: 0,
      data: null,
      networkError: true,
      isTimeout: isAbort,
    };
  }
}

/**
 * Normalizes FrozenYuki API order status strings into:
 * "success" | "completed" | "processing" | "pending" | "failed" | "unknown"
 */
export function normalizeFrozenYukiStatus(
  statusStr?: string | null
): "success" | "completed" | "processing" | "pending" | "failed" | "unknown" {
  if (!statusStr) return "unknown";
  const s = statusStr.trim().toLowerCase();

  if (s === "success" || s === "completed" || s === "done" || s === "delivered") {
    return "success";
  }
  if (
    s === "processing" ||
    s === "pending" ||
    s === "in_progress" ||
    s === "order_request_in_progress" ||
    s === "queued"
  ) {
    return "processing";
  }
  if (
    s === "failed" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "refunded" ||
    s === "rejected"
  ) {
    return "failed";
  }

  return "unknown";
}

/**
 * Maps FrozenYuki error strings to safe, user-friendly messages.
 */
function mapFrozenYukiError(errorKey?: string, fallbackMsg?: string): string {
  const key = (errorKey || fallbackMsg || "").toLowerCase();

  if (key.includes("insufficient_balance") || key.includes("balance")) {
    return "Topup service temporarily unavailable (provider balance). Please contact support.";
  }
  if (key.includes("rate_limited")) {
    return "Topup service is busy. Please try again shortly.";
  }
  if (key.includes("game_not_found")) {
    return "Game not found in topup provider catalogue.";
  }
  if (key.includes("order_not_found")) {
    return "Order not found in provider record.";
  }
  if (key.includes("invalid_or_missing_api_key")) {
    return "Provider API authentication error. Check server configuration.";
  }
  if (key.includes("missing_fields")) {
    return "Missing required player ID or server ID for this game.";
  }
  if (key.includes("idempotency_key_reused")) {
    return "Order idempotency key was already submitted.";
  }

  return fallbackMsg || errorKey || "Topup request was not accepted by FrozenYuki";
}

/**
 * Extracts game code and package code from productCode.
 *
 * Supports formats:
 * - "ff:100" -> { game: "ff", code: "100" }
 * - "ml:86"  -> { game: "ml", code: "86" }
 * - "100"    -> { game: defaultGame, code: "100" }
 */
function parseProductCode(
  productCode: string,
  hasServerId: boolean
): { game: string; code: string } {
  const trimmed = productCode.trim();
  if (trimmed.includes(":")) {
    const [g, ...rest] = trimmed.split(":");
    return { game: g.trim(), code: rest.join(":").trim() };
  }

  // Fallback heuristic: if serverId is provided, it's typically MLBB ("ml")
  const defaultGame = hasServerId ? "ml" : "ff";
  return { game: defaultGame, code: trimmed };
}

export class FrozenYukiSupplier implements TopupSupplier {
  readonly name = "frozenyuki" as const;
  readonly displayName = "FrozenYuki / SoraTopup";

  async createOrder(params: {
    productCode: string;
    playerId: string;
    serverId?: string;
    orderReference: string;
  }): Promise<TopUpResult> {
    const hasServer = Boolean(params.serverId && params.serverId.trim().length > 0);
    const { game, code } = parseProductCode(params.productCode, hasServer);

    // Build dynamic fieldValues in exact required order:
    // For games with server: [playerId, serverId]
    // For games without server: [playerId]
    const fieldValues: string[] = hasServer
      ? [params.playerId.trim(), params.serverId!.trim()]
      : [params.playerId.trim()];

    const body = {
      game,
      code,
      fieldValues,
    };

    try {
      const res = await callFrozenYuki("/order", {
        method: "POST",
        body,
        idempotencyKey: params.orderReference,
      });

      if (res.networkError) {
        return {
          success: false,
          unknown: true,
          error: res.isTimeout
            ? "FrozenYuki request timed out"
            : "Network error contacting FrozenYuki",
        };
      }

      const data = res.data;

      console.log(
        `[frozenyuki] create_order ref=${params.orderReference} http=${res.status} ok=${Boolean(
          data?.ok
        )} refid=${data?.refid ?? "N/A"} status=${data?.status ?? "N/A"}`
      );

      if (data && data.ok) {
        const normStatus = normalizeFrozenYukiStatus(data.status || "Processing");
        return {
          success: true,
          transactionId: data.refid || params.orderReference,
          status: normStatus,
          rawResponse: data,
        };
      }

      const errMsg = mapFrozenYukiError(data?.error, data?.msg);
      return {
        success: false,
        error: errMsg,
        rawResponse: data,
      };
    } catch (err: unknown) {
      if (err instanceof FrozenYukiConfigError) {
        return { success: false, error: err.message };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async checkOrder(
    orderReferenceOrSupplierId: string
  ): Promise<TopUpStatusResult> {
    try {
      const res = await callFrozenYuki("/order", {
        method: "GET",
        params: { ref: orderReferenceOrSupplierId },
      });

      if (res.networkError || !res.data) {
        return {
          found: false,
          status: "unknown",
          error: res.isTimeout
            ? "FrozenYuki status check timed out"
            : "Network error contacting FrozenYuki",
        };
      }

      const data = res.data;
      if (!data.ok) {
        return {
          found: false,
          status: "unknown",
          error: data.msg || data.error || "Order not found",
          rawResponse: data,
        };
      }

      const normStatus = normalizeFrozenYukiStatus(data.status);
      return {
        found: true,
        status: normStatus,
        transactionId: data.refid || orderReferenceOrSupplierId,
        productName: data.item,
        amount: typeof data.amount === "number" ? data.amount : undefined,
        rawResponse: data,
      };
    } catch (err: unknown) {
      return {
        found: false,
        status: "unknown",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getBalance(): Promise<TopupBalanceResult> {
    try {
      const res = await callFrozenYuki("/balance", {
        method: "GET",
      });

      if (res.networkError || !res.data) {
        return {
          success: false,
          currency: "USD",
          error: res.isTimeout
            ? "FrozenYuki balance request timed out"
            : "Network error contacting FrozenYuki",
        };
      }

      const data = res.data;
      if (!data.ok) {
        return {
          success: false,
          currency: "USD",
          error: data.msg || data.error || "Failed to fetch balance",
          rawResponse: data,
        };
      }

      return {
        success: true,
        balance: typeof data.balance === "number" ? data.balance : undefined,
        currency: data.currency || "USD",
        rawResponse: data,
      };
    } catch (err: unknown) {
      if (err instanceof FrozenYukiConfigError) {
        return { success: false, currency: "USD", error: err.message };
      }
      return {
        success: false,
        currency: "USD",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getCategories(): Promise<{
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
      const res = await callFrozenYuki("/catalogue", {
        method: "GET",
      });

      if (res.networkError || !res.data) {
        return {
          success: false,
          error: res.isTimeout
            ? "FrozenYuki catalogue request timed out"
            : "Network error contacting FrozenYuki",
        };
      }

      const data = res.data;
      if (!data.ok || !Array.isArray(data.games)) {
        return {
          success: false,
          error: data.msg || data.error || "Failed to fetch catalogue",
        };
      }

      return {
        success: true,
        categories: data.games.map((g) => ({
          gameCode: g.code || g.id || "",
          name: g.name,
          description: `Game code: ${g.code || g.id || "N/A"}`,
          fields: Array.isArray(g.fields) ? g.fields : ["User ID"],
        })),
      };
    } catch (err: unknown) {
      if (err instanceof FrozenYukiConfigError) {
        return { success: false, error: err.message };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getProducts(gameCode: string): Promise<{
    success: boolean;
    products?: Array<{
      id: number | string;
      productCode: string;
      name: string;
      sellPrice: number;
      active: boolean;
    }>;
    error?: string;
  }> {
    try {
      const res = await callFrozenYuki("/packages", {
        method: "GET",
        params: { game: gameCode },
      });

      if (res.networkError || !res.data) {
        return {
          success: false,
          error: res.isTimeout
            ? "FrozenYuki packages request timed out"
            : "Network error contacting FrozenYuki",
        };
      }

      const data = res.data;
      if (!data.ok || !Array.isArray(data.packages)) {
        return {
          success: false,
          error: data.msg || data.error || "Failed to fetch packages",
        };
      }

      return {
        success: true,
        products: data.packages.map((p) => ({
          id: p.code,
          productCode: `${gameCode}:${p.code}`,
          name: p.name,
          sellPrice: Number(p.price) || 0,
          active: true,
        })),
      };
    } catch (err: unknown) {
      if (err instanceof FrozenYukiConfigError) {
        return { success: false, error: err.message };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const frozenyukiSupplier = new FrozenYukiSupplier();

