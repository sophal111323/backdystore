import { logSecurityEvent } from "@/lib/secureLogger";

export type OrderPaymentSnapshot = {
  id: string;
  orderNumber: string;
  paymentRef: string | null;
  amountUsd: number;
  currency: string;
  status: string;
};
export type RemotePaymentSnapshot = {
  orderNumber?: string | null;
  transactionId?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  status?: string | null;
  paid?: boolean | null;
};

export type PaymentValidationIssueCode =
  | "ORDER_NUMBER_MISMATCH"
  | "MISSING_TRANSACTION_ID"
  | "MISSING_ORDER_PAYMENT_REF"
  | "TRANSACTION_ID_MISMATCH"
  | "MISSING_REMOTE_AMOUNT"
  | "AMOUNT_MISMATCH"
  | "MISSING_REMOTE_CURRENCY"
  | "CURRENCY_MISMATCH";

export type PaymentValidationResult =
  | {
      ok: true;
      transactionId: string;
      amount: number;
      currency: string;
      orderNumber: string;
    }
  | {
      ok: false;
      code: PaymentValidationIssueCode;
      message: string;
      detail: string;
    };

function cleanEnv(value?: string): string {
  return (value || "").trim().replace(/^['\"]|['\"]$/g, "");
}

function parseAmount(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCurrency(currency: string | null | undefined): string {
  return String(currency ?? "").trim().toUpperCase();
}

export function amountsMatch(
  expected: string | number | null | undefined,
  actual: string | number | null | undefined,
  tolerance = 0.01
): boolean {
  const expectedAmount = parseAmount(expected);
  const actualAmount = parseAmount(actual);

  if (expectedAmount === null || actualAmount === null) return false;
  return Math.abs(expectedAmount - actualAmount) <= tolerance;
}

export function isRemotePaid(remote: RemotePaymentSnapshot | null | undefined): boolean {
  if (!remote) return false;

  const normalizedStatus = String(remote.status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const words = normalizedStatus.split("_").filter(Boolean);
  const failedWords = ["failed", "failure", "cancelled", "canceled", "expired", "rejected", "declined"];
  const paidWords = ["paid", "approved", "success", "succeeded", "completed"];

  if (words.some((word) => failedWords.includes(word))) return false;
  return remote.paid === true || words.some((word) => paidWords.includes(word));
}

export function validatePaymentForOrder(
  order: OrderPaymentSnapshot,
  remotePayment: RemotePaymentSnapshot
): PaymentValidationResult {
  const remoteOrderNumber = String(remotePayment.orderNumber ?? "").trim();
  const transactionId = String(remotePayment.transactionId ?? "").trim();
  const remoteCurrency = normalizeCurrency(remotePayment.currency);
  const expectedCurrency = normalizeCurrency(order.currency || "USD");
  const remoteAmount = parseAmount(remotePayment.amount);

  if (remoteOrderNumber !== order.orderNumber) {
    return {
      ok: false,
      code: "ORDER_NUMBER_MISMATCH",
      message: "Payment order reference does not match this order.",
      detail: `got=${remoteOrderNumber || "missing"}; expected=${order.orderNumber}`,
    };
  }

  if (!transactionId) {
    return {
      ok: false,
      code: "MISSING_TRANSACTION_ID",
      message: "Payment transaction ID is missing.",
      detail: `order=${order.orderNumber}`,
    };
  }

  if (!order.paymentRef) {
    return {
      ok: false,
      code: "MISSING_ORDER_PAYMENT_REF",
      message: "Order has no payment reference to verify against.",
      detail: `order=${order.orderNumber}; transactionId=${transactionId}`,
    };
  }

  if (order.paymentRef !== transactionId) {
    return {
      ok: false,
      code: "TRANSACTION_ID_MISMATCH",
      message: "Payment transaction does not belong to this order.",
      detail: `order=${order.orderNumber}; got=${transactionId}; expected=${order.paymentRef}`,
    };
  }

  if (remoteAmount === null) {
    return {
      ok: false,
      code: "MISSING_REMOTE_AMOUNT",
      message: "Payment amount is missing or invalid.",
      detail: `order=${order.orderNumber}; expected=${order.amountUsd}`,
    };
  }

  if (!amountsMatch(order.amountUsd, remoteAmount)) {
    return {
      ok: false,
      code: "AMOUNT_MISMATCH",
      message: "Payment amount does not match this order.",
      detail: `order=${order.orderNumber}; got=${remoteAmount}; expected=${order.amountUsd}`,
    };
  }

  if (!remoteCurrency) {
    return {
      ok: false,
      code: "MISSING_REMOTE_CURRENCY",
      message: "Payment currency is missing.",
      detail: `order=${order.orderNumber}; expected=${expectedCurrency}`,
    };
  }

  if (remoteCurrency !== expectedCurrency) {
    return {
      ok: false,
      code: "CURRENCY_MISMATCH",
      message: "Payment currency does not match this order.",
      detail: `order=${order.orderNumber}; got=${remoteCurrency}; expected=${expectedCurrency}`,
    };
  }

  return {
    ok: true,
    transactionId,
    amount: remoteAmount,
    currency: remoteCurrency,
    orderNumber: remoteOrderNumber,
  };
}

export function logPaymentValidationFailure(
  source: "webhook" | "admin_refresh" | "public_sync" | "internal_sync",
  result: Exclude<PaymentValidationResult, { ok: true }>
): void {
  const event =
    result.code === "AMOUNT_MISMATCH" || result.code === "MISSING_REMOTE_AMOUNT"
      ? "payment_amount_mismatch"
      : result.code === "CURRENCY_MISMATCH" || result.code === "MISSING_REMOTE_CURRENCY"
        ? "payment_currency_mismatch"
        : result.code === "TRANSACTION_ID_MISMATCH" || result.code === "ORDER_NUMBER_MISMATCH"
          ? "payment_transaction_mismatch"
          : "payment_missing_ref";

  logSecurityEvent({
    event,
    detail: `${source}: ${result.code}: ${result.detail}`,
  });
}

export function assertProductionPaymentConfig(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const simulationMode = cleanEnv(process.env.PAYMENT_SIMULATION_MODE).toLowerCase() === "true";
  const tolaSaintApiKey = cleanEnv(process.env.TOLA_SAINT_API_KEY);

  if (isProduction && simulationMode) {
    logSecurityEvent({
      event: "payment_simulation_production",
      detail: "PAYMENT_SIMULATION_MODE=true blocked in production",
    });
    throw new Error("PAYMENT_SIMULATION_MODE=true is not allowed in production.");
  }

  if (isProduction && !tolaSaintApiKey) {
    logSecurityEvent({
      event: "payment_config_error",
      detail: "Missing TOLA_SAINT_API_KEY in production",
    });
    throw new Error("TOLA_SAINT_API_KEY is required in production.");
  }
}

export function assertRealTolaSaintConfig(): void {
  assertProductionPaymentConfig();

  const tolaSaintApiKey = cleanEnv(process.env.TOLA_SAINT_API_KEY);
  if (!tolaSaintApiKey) {
    logSecurityEvent({
      event: "payment_config_error",
      detail: "Missing TOLA_SAINT_API_KEY while real Tola Saint mode was requested",
    });
    throw new Error(
      "TOLA_SAINT_API_KEY is required for real Tola Saint payments. For local testing only, set PAYMENT_SIMULATION_MODE=true."
    );
  }
}
