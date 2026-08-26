// lib/topup/types.ts
//
// Shared game top-up provider types. Provider-specific code lives in
// lib/topup/providers/* — the rest of the app calls the generic API in
// lib/topup/index.ts only.

export interface TopUpRequest {
  /** Unique reference — we always use the internal order number. */
  reference: string;
  /** Provider product code (Product.supplierCode). */
  productCode: string;
  /** Player ID inside the game. */
  userId: string;
  /** Zone / server ID when the game requires it. */
  zoneId?: string;
}

export interface TopUpResult {
  success: boolean;
  transactionId?: string;
  status?: string;
  error?: string;
  /**
   * True when the request failed at network level (timeout / connection).
   * The outcome at the provider is UNKNOWN — callers must check status via
   * the reference before ever creating a new top-up.
   */
  unknown?: boolean;
}

export interface TopUpStatusResult {
  found: boolean;
  /** Normalized provider status: "success" | "failed" | "pending" | "unknown". */
  status: "success" | "failed" | "pending" | "unknown";
  transactionId?: string;
  productName?: string;
  amount?: number;
  error?: string;
}
