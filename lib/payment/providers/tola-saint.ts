// lib/payment/providers/tola-saint.ts
//
// Tola Saint KHQR payment gateway adapter.
// Implemented strictly against the official documentation at
// https://tolasaint.com/docs :
//   - Base URL:      https://api.tolasaint.com
//   - Auth:          x-api-key header (secret key)
//   - Create:        POST /v1/payment            → 201 {id,status,qr_string,...}
//   - Status:        GET  /v1/payment/status?id= → 200 {id,amount,currency,status}
//   - Statuses:      pending | scanned | processing | paid | approved (legacy,
//                    treated as paid) | failed | expired
//   - Webhooks:      HMAC-SHA256(secret, timestamp + "." + rawBody),
//                    header x-webhook-signature = "sha256=<hex>",
//                    timestamp header x-webhook-timestamp (epoch ms).
//   - Rate limits:   create 20/min per key; status 30/min per payment id.
//                    Callers MUST reuse an open QR instead of creating new ones.

import { createHmac, timingSafeEqual } from "crypto";
import {
  assertProductionPaymentConfig,
  assertRealTolaSaintConfig,
} from "@/lib/payment-validation";
import type {
  InitiatePaymentArgs,
  PaymentInitResult,
  PaymentStatusResult,
} from "../types";

function cleanEnv(value?: string): string {
  return (value || "").trim().replace(/^['"]|['"]$/g, "");
}

function cleanBaseUrl(value?: string): string {
  return cleanEnv(value).replace(/\/+$/, "");
}

const TOLA_SAINT_BASE =
  cleanBaseUrl(process.env.TOLA_SAINT_BASE_URL) || "https://api.tolasaint.com";

/** Optional rail override — documented field `provider`: "aba" | "bakong". */
function configuredRail(): "aba" | "bakong" | undefined {
  const rail = cleanEnv(process.env.TOLA_SAINT_PROVIDER).toLowerCase();
  return rail === "aba" || rail === "bakong" ? rail : undefined;
}

/**
 * Normalize a Tola Saint status into one of the documented values.
 * "approved" is a legacy success value identical in meaning to "paid"
 * (per official docs) — map it to "paid".
 */
export function normalizeTolaSaintStatus(
  value: unknown
): "pending" | "scanned" | "processing" | "paid" | "failed" | "expired" {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "approved") return "paid"; // legacy success value
  if (
    ["pending", "scanned", "processing", "paid", "failed", "expired"].includes(
      raw
    )
  ) {
    return raw as "pending" | "scanned" | "processing" | "paid" | "failed" | "expired";
  }

  return "pending";
}

export function isTerminalTolaSaintStatus(status: string): boolean {
  const normalized = normalizeTolaSaintStatus(status);
  return ["paid", "failed", "expired"].includes(normalized);
}

function formatAmount(amount: number, currency: string): string {
  // Docs: amounts are ALWAYS strings. USD allows max 2 dp; KHR whole numbers.
  if (currency === "KHR") return String(Math.round(amount));
  return amount.toFixed(2);
}

function isPublicHttpsUrl(u?: string): boolean {
  if (!u) return false;

  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return false;
  }

  // Docs: success_url/expire_url must be https and carry no credentials.
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (/^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(parsed.hostname)) {
    return false;
  }

  return true;
}

async function readJsonOrText(res: Response): Promise<any> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

function formatTolaSaintError(status: number, payload: any): string {
  // Docs error shape: { "error": "<machine_code>", "message": "<human>" }
  const code = payload?.error;
  const message = payload?.message;

  if (status === 401) {
    return [
      `HTTP ${status}`,
      "Tola Saint refused this request (unauthorized).",
      "Check TOLA_SAINT_API_KEY.",
      message ? `Remote: ${String(message).slice(0, 180)}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (status === 429) {
    return [
      `HTTP 429`,
      "Tola Saint rate limit reached. Reuse an existing open QR instead of creating a new payment.",
      code ? `Remote code: ${code}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (code || message) {
    return [code, message].filter(Boolean).join(": ");
  }

  return `HTTP ${status}`;
}

// ── continued ────────────────────────────────────────────────────────────────

/**
 * Create a KHQR payment on Tola Saint.
 *
 * Security: the amount/currency passed here MUST come from the database order
 * (server-side), never from browser input.
 */
export async function initiateTolaSaintPayment(
  args: InitiatePaymentArgs
): Promise<PaymentInitResult> {
  assertRealTolaSaintConfig();

  const apiKey = cleanEnv(process.env.TOLA_SAINT_API_KEY);
  const currency = (args.currency || "USD").trim().toUpperCase();

  const body: Record<string, unknown> = {
    amount: formatAmount(args.amountUsd, currency),
    currency,
    // Our order number becomes the merchant reference (≤128 chars, echoed in
    // webhooks) — this is how webhooks are matched back to the order.
    reference: args.orderNumber,
    metadata: {
      order_number: args.orderNumber,
      ...(args.customerEmail ? { email: args.customerEmail } : {}),
      ...(args.metadata || {}),
    },
  };

  const rail = configuredRail();
  if (rail) body.provider = rail;

  if (isPublicHttpsUrl(args.returnUrl)) body.success_url = args.returnUrl;
  if (isPublicHttpsUrl(args.cancelUrl)) body.expire_url = args.cancelUrl;

  const res = await fetch(`${TOLA_SAINT_BASE}/v1/payment`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = await readJsonOrText(res);

  if (!res.ok) {
    throw new Error(`Tola Saint: ${formatTolaSaintError(res.status, json)}`);
  }

  // Documented 201 response:
  // { id, status:"pending", provider, webhooks_supported, amount, currency,
  //   qr_link, checkout_link, qr_string, expires_at, reference }
  const id = typeof json?.id === "string" ? json.id.trim() : "";
  if (!id) throw new Error("Tola Saint: response did not include payment id");

  const qrString =
    typeof json?.qr_string === "string" && json.qr_string
      ? json.qr_string
      : undefined;

  const checkoutLink =
    typeof json?.checkout_link === "string" && json.checkout_link
      ? json.checkout_link
      : typeof json?.qr_link === "string" && json.qr_link
        ? json.qr_link
        : "";

  if (!json?.expires_at) {
    throw new Error("Tola Saint: response did not include expires_at");
  }
  const expiresAt = new Date(json.expires_at);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error("Tola Saint: invalid expires_at in response");
  }

  return {
    paymentRef: id,
    redirectUrl: checkoutLink,
    qrString,
    expiresAt,
  };
}

/**
 * Query the documented status endpoint.
 * GET /v1/payment/status?id=<payment id>
 * → { id, amount, currency, status }
 *
 * Note: this endpoint does not echo `reference`; callers that need to match
 * the order use their stored order.paymentRef and fall back locally.
 */
export async function fetchTolaSaintStatus(
  paymentId: string
): Promise<PaymentStatusResult | null> {
  assertProductionPaymentConfig();

  if (!paymentId || paymentId.startsWith("SIM-")) return null;
  assertRealTolaSaintConfig();

  const apiKey = cleanEnv(process.env.TOLA_SAINT_API_KEY);

  const url = new URL(`${TOLA_SAINT_BASE}/v1/payment/status`);
  url.searchParams.set("id", paymentId);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const json = await readJsonOrText(res);

    if (!res.ok) {
      console.warn(
        `[tolasaint] status check failed for payment: HTTP ${res.status}`,
        json?.error || ""
      );
      return null;
    }

    if (!json?.id || !json?.status) return null;

    const status = normalizeTolaSaintStatus(json.status);

    return {
      // Report the DOCUMENTED raw status ("paid"/"approved"/...); internal
      // mapping happens via normalizeTolaSaintStatus / isRemotePaid.
      status: String(json.status).toLowerCase(),
      paid: status === "paid",
      transactionId: String(json.id),
      amount:
        typeof json.amount === "string" || typeof json.amount === "number"
          ? String(json.amount)
          : undefined,
      currency:
        typeof json.currency === "string"
          ? json.currency.toUpperCase()
          : undefined,
    };
  } catch (err) {
    console.warn(
      "[tolasaint] status check error:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Verify a Tola Saint webhook signature EXACTLY as documented:
 *
 *   expected = "sha256=" + HMAC_SHA256(secret, timestamp + "." + rawBody)
 *   compared against x-webhook-signature with a timing-safe comparison.
 */
export function verifyTolaSaintWebhookSignature(
  headers: Record<string, string>,
  rawBody: string
): boolean {
  const secret = cleanEnv(process.env.TOLA_SAINT_WEBHOOK_SECRET);
  if (!secret) {
    console.warn(
      "[tolasaint] TOLA_SAINT_WEBHOOK_SECRET not set — rejecting webhook."
    );
    return false;
  }

  const timestamp = headers["x-webhook-timestamp"] || "";
  const received = headers["x-webhook-signature"] || "";
  if (!timestamp || !received) return false;

  const expected =
    "sha256=" +
    createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

export type TolaSaintWebhookEvent = {
  id: string;
  reference: string | null;
  provider: "aba" | "bakong" | null;
  amount: string | null;
  currency: string | null;
  status:
    | "pending"
    | "scanned"
    | "processing"
    | "paid"
    | "failed"
    | "expired";
  paidAt: string | null;
  occurredAt: string | null;
};

/**
 * Parse the documented webhook payload:
 * { id, reference, provider, amount, currency, status, paid_at, occurred_at }
 */
export function parseTolaSaintWebhookEvent(
  payload: any
): TolaSaintWebhookEvent | null {
  if (!payload || typeof payload !== "object") return null;

  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) return null;

  return {
    id,
    reference: typeof payload.reference === "string" ? payload.reference : null,
    provider:
      payload.provider === "aba" || payload.provider === "bakong"
        ? payload.provider
        : null,
    amount:
      typeof payload.amount === "string" || typeof payload.amount === "number"
        ? String(payload.amount)
        : null,
    currency:
      typeof payload.currency === "string"
        ? payload.currency.toUpperCase()
        : null,
    status: normalizeTolaSaintStatus(payload.status),
    paidAt: typeof payload.paid_at === "string" ? payload.paid_at : null,
    occurredAt:
      typeof payload.occurred_at === "string" ? payload.occurred_at : null,
  };
}

