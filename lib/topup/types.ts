// lib/topup/types.ts
//
// Shared game top-up provider types. Provider-specific code lives in
// lib/topup/providers/* — the rest of the app calls the generic API in
// lib/topup/index.ts only.

export type TopupSupplierType = "bay2game" | "khmer_topup" | "frozenyuki" | "soratopup";

export interface TopUpRequest {
  /** Unique reference — we always use the internal order number. */
  reference: string;
  /** Provider product code (Product.supplierCode or Khmer TopUp package_id or FrozenYuki code). */
  productCode: string;
  /** Player ID inside the game. */
  userId: string;
  /** Zone / server ID when the game requires it. */
  zoneId?: string;
  /** Supplier to use ("bay2game" | "khmer_topup" | "frozenyuki"). Defaults to "bay2game". */
  supplier?: TopupSupplierType | string;
}

export interface TopUpResult {
  success: boolean;
  transactionId?: string;
  /** Normalized status: "success" | "completed" | "processing" | "pending" | "failed" | "unknown" */
  status?: string;
  error?: string;
  /**
   * True when the request failed at network level (timeout / connection).
   * The outcome at the provider is UNKNOWN — callers must check status via
   * the reference before ever creating a new top-up.
   */
  unknown?: boolean;
  /** Raw response from the supplier API. */
  rawResponse?: unknown;
}

export interface TopUpStatusResult {
  found: boolean;
  /** Normalized provider status: "success" | "completed" | "failed" | "pending" | "processing" | "unknown". */
  status: "success" | "completed" | "failed" | "pending" | "processing" | "unknown";
  transactionId?: string;
  productName?: string;
  amount?: number;
  error?: string;
  /** Raw response from the supplier API. */
  rawResponse?: unknown;
}

export interface TopupBalanceResult {
  success: boolean;
  balance?: number;
  currency: string;
  username?: string;
  totalOrders?: number;
  totalSpent?: number;
  error?: string;
  rawResponse?: unknown;
}

export interface TopupSupplier {
  readonly name: TopupSupplierType;
  readonly displayName: string;

  createOrder(params: {
    productCode: string;
    playerId: string;
    serverId?: string;
    orderReference: string;
  }): Promise<TopUpResult>;

  checkOrder?(
    orderReferenceOrSupplierId: string
  ): Promise<TopUpStatusResult>;

  getBalance?(): Promise<TopupBalanceResult>;

  getCategories?(): Promise<{
    success: boolean;
    categories?: Array<{
      gameCode: string;
      name: string;
      description?: string;
      imageUrl?: string;
      fields: string[];
    }>;
    error?: string;
  }>;

  getProducts?(gameCode: string): Promise<{
    success: boolean;
    products?: Array<{
      id: number | string;
      productCode: string;
      name: string;
      sellPrice: number;
      active: boolean;
    }>;
    error?: string;
  }>;
}
