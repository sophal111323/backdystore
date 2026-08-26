// lib/payment/index.ts
//
// Generic payment API. The rest of the app calls ONLY these functions —
// never the provider directly. Swapping providers later means editing this
// file and lib/payment/providers/*.

import crypto from "crypto";
import { assertProductionPaymentConfig } from "@/lib/payment-validation";
import {
  initiateTolaSaintPayment,
  fetchTolaSaintStatus,
  verifyTolaSaintWebhookSignature,
  parseTolaSaintWebhookEvent,
} from "./providers/tola-saint";

// Re-export provider helpers used by route handlers (webhook parsing).
export { parseTolaSaintWebhookEvent } from "./providers/tola-saint";
export type { TolaSaintWebhookEvent } from "./providers/tola-saint";
import type {
  InitiatePaymentArgs,
  PaymentInitResult,
  PaymentMethod,
  PaymentStatusResult,
} from "./types";

export type {
  InitiatePaymentArgs,
  PaymentInitResult,
  PaymentMethod,
  PaymentStatusResult,
} from "./types";

function cleanEnv(value?: string): string {
  return (value || "").trim().replace(/^['"]|['"]$/g, "");
}

function cleanBaseUrl(value?: string): string {
  return cleanEnv(value).replace(/\/+$/, "");
}

// ── Simulation mode (local development only) ─────────────────────────────────

export function isPaymentSimulationMode(): boolean {
  assertProductionPaymentConfig();
  return cleanEnv(process.env.PAYMENT_SIMULATION_MODE).toLowerCase() === "true";
}

export function isPaymentSimulationAllowed(): boolean {
  assertProductionPaymentConfig();
  return process.env.NODE_ENV !== "production" && isPaymentSimulationMode();
}

function getAppBaseUrl(): string {
  const configured = cleanBaseUrl(
    process.env.NEXT_PUBLIC_BASE_URL || process.env.PUBLIC_APP_URL
  );
  if (configured) return configured;

  const vercelUrl = cleanBaseUrl(process.env.VERCEL_URL);
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}

function simulatePayment(args: InitiatePaymentArgs): PaymentInitResult {
  const ref = `SIM-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const base = getAppBaseUrl();
  return {
    paymentRef: ref,
    redirectUrl: `${base}/api/payment/simulate?order=${encodeURIComponent(args.orderNumber)}&ref=${encodeURIComponent(ref)}&method=${encodeURIComponent(args.method)}`,
    expiresAt: new Date(Date.now() + 1 * 60 * 1000),
  };
}

// ── Generic provider API ─────────────────────────────────────────────────────

/**
 * Create a payment for an order.
 * The amount MUST be loaded server-side from the database order.
 */
export async function initiatePayment(
  args: InitiatePaymentArgs
): Promise<PaymentInitResult> {
  assertProductionPaymentConfig();

  if (isPaymentSimulationMode()) return simulatePayment(args);

  if (args.method !== "TOLASAINT") {
    throw new Error(
      `Payment method ${args.method} is not supported for real payments yet. Use TOLASAINT or enable PAYMENT_SIMULATION_MODE=true only in local development.`
    );
  }

  return initiateTolaSaintPayment(args);
}

/**
 * Query the provider for the current status of a stored payment reference.
 * Returns null when there is nothing usable (simulation refs, config missing,
 * or remote errors) — callers must treat null as "unknown", never as "paid".
 */
export async function fetchPaymentStatus(
  transactionId: string
): Promise<PaymentStatusResult | null> {
  assertProductionPaymentConfig();

  if (!transactionId || transactionId.startsWith("SIM-")) return null;

  return fetchTolaSaintStatus(transactionId);
}

/**
 * Verify a webhook signature against the active provider.
 * Returns true only when the signature is valid per the provider's documented
 * algorithm. Never bypassed by simulation mode.
 */
export function verifyWebhook(
  method: PaymentMethod,
  rawBody: string,
  headers: Record<string, string>
): boolean {
  if (method !== "TOLASAINT") return false;
  return verifyTolaSaintWebhookSignature(headers, rawBody);
}
