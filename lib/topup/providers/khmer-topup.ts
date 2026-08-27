// lib/topup/providers/khmer-topup.ts
//
// Khmer TopUp game top-up adapter.
// Implemented strictly against the official documentation at
// https://khmer-topup.com/api-docs :
//
//   Base URL:   https://khmer-topup.com/api/v1
//   Auth:       Authorization: Bearer <API_KEY>  or  X-API-Key: <API_KEY>
//
//   GET  /me                       → {username, role, balance, currency}
//   GET  /games                    → {games: [{slug, name, id_label, server_label, packages: [...]}]}
//   GET  /check                    ?slug=&player_id=&server_id= → {result:"valid"|"invalid"|"incomplete"|"unknown", nickname}
//   POST /orders                   {package_id, player_id, server_id, reference}
//                                  → {order_code, status:"processing"|"completed", game, package, price, balance, reference, idempotent}
//   GET  /orders/{order_code}      → {order_code, status:"completed"|"processing"|"refunded", game, package, price}

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

function getKhmerTopupBaseUrl(): string {
  let raw =
    cleanEnv(process.env.KHMER_TOPUP_BASE_URL) ||
    cleanEnv(process.env.KHMER_TOPUP_API_URL) ||
    "https://khmer-topup.com/api/v1";

  raw = raw.replace(/\/+$/, "");
  if (!raw.endsWith("/api/v1") && !raw.includes("/api/")) {
    raw += "/api/v1";
  }
  return raw;
}

const TIMEOUT_MS = 20_000;

export class KhmerTopupConfigError extends Error {
  constructor() {
    super(
      "KHMER_TOPUP_API_KEY is not configured. Set it in the environment to enable Khmer TopUp auto delivery."
    );
    this.name = "KhmerTopupConfigError";
  }
}

/** Redact sensitive info before logging */
function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out = { ...headers };
  if ("Authorization" in out) out.Authorization = "[REDACTED]";
  if ("X-API-Key" in out) out["X-API-Key"] = "[REDACTED]";
  return out;
}

async function callKhmerTopup(
  endpoint: string,
  options: {
    method: "GET" | "POST";
    body?: any;
    params?: Record<string, string>;
  }
): Promise<{ ok: boolean; status: number; data: any | null; networkError?: boolean; isTimeout?: boolean }> {
  const apiKey = cleanEnv(process.env.KHMER_TOPUP_API_KEY);
  if (!apiKey) throw new KhmerTopupConfigError();

  const baseUrl = getKhmerTopupBaseUrl();
  const url = new URL(`${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`);

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
    "X-API-Key": apiKey,
    Accept: "application/json",
    "User-Agent": "JASMINTOPUP/1.0",
  };

  if (options.body && options.method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(url.toString(), {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
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
      `[khmer_topup] ${options.method} ${endpoint} ${isAbort ? "timed out" : "network error"}`
    );
    return { ok: false, status: 0, data: null, networkError: true, isTimeout: isAbort };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalize Khmer TopUp order status:
 * "completed" → "success"
 * "processing" → "pending"
 * "refunded" → "failed"
 */
export function normalizeKhmerTopupStatus(
  value: unknown
): "success" | "completed" | "failed" | "pending" | "processing" | "unknown" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "completed" || raw === "success") return "success";
  if (raw === "processing" || raw === "pending") return "pending";
  if (raw === "refunded" || raw === "failed") return "failed";
  return "unknown";
}

export class KhmerTopupSupplier implements TopupSupplier {
  readonly name = "khmer_topup" as const;
  readonly displayName = "Khmer TopUp";

  /**
   * Create an order via POST /api/v1/orders
   *
   * Body payload:
   *   package_id: number (from Product.supplierCode)
   *   player_id: string
   *   server_id: string (optional)
   *   reference: string (internal order number for idempotency)
   */
  async createOrder(params: {
    productCode: string;
    playerId: string;
    serverId?: string;
    orderReference: string;
  }): Promise<TopUpResult> {
    try {
      const packageId = Number(params.productCode);
      if (!Number.isFinite(packageId) || packageId <= 0) {
        return {
          success: false,
          error: `Invalid Khmer TopUp package_id: "${params.productCode}". Must be a valid numeric package ID.`,
        };
      }

      const bodyPayload: Record<string, any> = {
        package_id: packageId,
        player_id: params.playerId.trim(),
        reference: params.orderReference,
      };

      if (params.serverId && params.serverId.trim()) {
        bodyPayload.server_id = params.serverId.trim();
      }

      const res = await callKhmerTopup("/orders", {
        method: "POST",
        body: bodyPayload,
      });

      if (res.networkError || res.isTimeout) {
        return {
          success: false,
          unknown: true,
          error: res.isTimeout
            ? "Khmer TopUp timed out — outcome unknown"
            : "Network error contacting Khmer TopUp",
        };
      }

      const data = res.data;
      console.log(
        `[khmer_topup] create_order ref=${params.orderReference} http=${res.status} status=${data?.status ?? "?"} order_code=${data?.order_code ?? "N/A"}`
      );

      if (res.ok && data && (data.order_code || data.status)) {
        const orderStatus = String(data.status ?? "").toLowerCase();

        if (orderStatus === "completed") {
          return {
            success: true,
            transactionId: String(data.order_code || params.orderReference),
            status: "completed",
            rawResponse: data,
          };
        }

        if (orderStatus === "processing" || orderStatus === "pending") {
          return {
            success: true,
            transactionId: String(data.order_code || params.orderReference),
            status: "processing",
            rawResponse: data,
          };
        }

        if (orderStatus === "refunded" || orderStatus === "failed") {
          return {
            success: false,
            transactionId: data.order_code ? String(data.order_code) : undefined,
            status: "failed",
            error: String(data.error || "Order was refunded or rejected by Khmer TopUp"),
            rawResponse: data,
          };
        }
      }

      // Handle documented error cases (400 invalid param, 401 invalid key, 402 insufficient balance, etc.)
      const errorMessage =
        data?.error ||
        data?.message ||
        (res.status === 402 ? "Insufficient Khmer TopUp wallet balance" : `HTTP ${res.status}`);

      return {
        success: false,
        error: String(errorMessage),
        rawResponse: data,
      };
    } catch (err) {
      if (err instanceof KhmerTopupConfigError) {
        return { success: false, error: err.message };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unexpected error calling Khmer TopUp",
      };
    }
  }

  /**
   * Check order status via GET /api/v1/orders/{order_code}
   */
  async checkOrder(referenceOrOrderCode: string): Promise<TopUpStatusResult> {
    try {
      const res = await callKhmerTopup(`/orders/${encodeURIComponent(referenceOrOrderCode)}`, {
        method: "GET",
      });

      if (res.networkError || !res.data) {
        return {
          found: false,
          status: "unknown",
          error: "Network error contacting Khmer TopUp",
        };
      }

      if (res.ok && res.data) {
        const data = res.data;
        const normalized = normalizeKhmerTopupStatus(data.status);

        return {
          found: true,
          status: normalized,
          transactionId: String(data.order_code ?? referenceOrOrderCode),
          productName: data.package ? String(data.package) : undefined,
          amount: typeof data.price !== "undefined" ? Number(data.price) : undefined,
          rawResponse: data,
        };
      }

      return {
        found: false,
        status: "unknown",
        error: String(res.data?.error || res.data?.message || `HTTP ${res.status}`),
        rawResponse: res.data,
      };
    } catch (err) {
      if (err instanceof KhmerTopupConfigError) {
        return { found: false, status: "unknown", error: err.message };
      }
      return { found: false, status: "unknown", error: "Unexpected error checking Khmer TopUp status" };
    }
  }

  /**
   * Get reseller balance & profile via GET /api/v1/me
   */
  async getBalance(): Promise<TopupBalanceResult> {
    try {
      const res = await callKhmerTopup("/me", { method: "GET" });

      if (res.networkError || !res.data) {
        return {
          success: false,
          currency: "USD",
          error: "Network error contacting Khmer TopUp",
        };
      }

      if (res.ok && res.data) {
        return {
          success: true,
          balance: Number(res.data.balance) || 0,
          currency: res.data.currency || "USD",
          username: res.data.username,
          rawResponse: res.data,
        };
      }

      return {
        success: false,
        currency: "USD",
        error: String(res.data?.error || res.data?.message || `HTTP ${res.status}`),
        rawResponse: res.data,
      };
    } catch (err) {
      if (err instanceof KhmerTopupConfigError) {
        return { success: false, currency: "USD", error: err.message };
      }
      return { success: false, currency: "USD", error: "Unexpected error fetching Khmer TopUp balance" };
    }
  }

  /**
   * List games & package catalog via GET /api/v1/games
   */
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
      const res = await callKhmerTopup("/games", { method: "GET" });

      if (res.networkError || !res.data) {
        return { success: false, error: "Network error contacting Khmer TopUp" };
      }

      if (res.ok && Array.isArray(res.data.games)) {
        return {
          success: true,
          categories: res.data.games.map((g: any) => ({
            gameCode: String(g.slug ?? ""),
            name: String(g.name ?? ""),
            fields: [g.id_label || "Player ID", ...(g.server_label ? [g.server_label] : [])],
          })),
        };
      }

      return { success: false, error: String(res.data?.error || `HTTP ${res.status}`) };
    } catch (err) {
      if (err instanceof KhmerTopupConfigError) return { success: false, error: err.message };
      return { success: false, error: "Unexpected error fetching Khmer TopUp catalog" };
    }
  }

  /**
   * List packages for a game via GET /api/v1/games
   */
  async getProducts(gameSlug: string): Promise<{
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
      const res = await callKhmerTopup("/games", { method: "GET" });

      if (res.networkError || !res.data) {
        return { success: false, error: "Network error contacting Khmer TopUp" };
      }

      if (res.ok && Array.isArray(res.data.games)) {
        const game = res.data.games.find(
          (g: any) => String(g.slug).toLowerCase() === gameSlug.toLowerCase()
        );

        if (!game || !Array.isArray(game.packages)) {
          return { success: true, products: [] };
        }

        return {
          success: true,
          products: game.packages.map((pkg: any) => ({
            id: Number(pkg.package_id) || 0,
            productCode: String(pkg.package_id ?? ""),
            name: String(pkg.name ?? ""),
            sellPrice: Number(pkg.price) || 0,
            active: true,
          })),
        };
      }

      return { success: false, error: String(res.data?.error || `HTTP ${res.status}`) };
    } catch (err) {
      if (err instanceof KhmerTopupConfigError) return { success: false, error: err.message };
      return { success: false, error: "Unexpected error fetching Khmer TopUp products" };
    }
  }

  /**
   * Verify player account via GET /api/v1/check
   */
  async checkAccount(params: {
    slug: string;
    playerId: string;
    serverId?: string;
  }): Promise<{
    valid: boolean;
    result: "valid" | "invalid" | "incomplete" | "unknown";
    nickname?: string;
    error?: string;
  }> {
    try {
      const res = await callKhmerTopup("/check", {
        method: "GET",
        params: {
          slug: params.slug,
          player_id: params.playerId,
          server_id: params.serverId || "",
        },
      });

      if (res.ok && res.data) {
        const result = res.data.result;
        return {
          valid: result === "valid",
          result: result || "unknown",
          nickname: res.data.nickname,
        };
      }

      return { valid: false, result: "unknown", error: res.data?.error || `HTTP ${res.status}` };
    } catch (err) {
      return { valid: false, result: "unknown", error: "Failed to check account" };
    }
  }
}

export const khmerTopupSupplier = new KhmerTopupSupplier();
