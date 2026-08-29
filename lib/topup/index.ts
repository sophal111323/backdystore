// lib/topup/index.ts
//
// Generic game top-up API. The rest of the app calls ONLY these functions —
// never the provider directly. Routes dynamically to Bay2Game or Khmer TopUp
// based on product supplier configuration.

import type {
  TopupSupplier,
  TopupSupplierType,
  TopupBalanceResult,
  TopUpRequest,
  TopUpResult,
  TopUpStatusResult,
} from "./types";

import {
  bay2gameSupplier,
  Bay2GameSupplier,
  normalizeBay2GameStatus,
  createTopup as bay2gameCreateTopup,
  getTopupStatus as bay2gameGetTopupStatus,
  getBalance as bay2gameGetBalance,
  getCategories as bay2gameGetCategories,
  getProducts as bay2gameGetProducts,
} from "./providers/bay2game";

import {
  khmerTopupSupplier,
  KhmerTopupSupplier,
  normalizeKhmerTopupStatus,
} from "./providers/khmer-topup";

import {
  frozenyukiSupplier,
  FrozenYukiSupplier,
  normalizeFrozenYukiStatus,
} from "./providers/frozenyuki";

export type {
  TopupSupplier,
  TopupSupplierType,
  TopupBalanceResult,
  TopUpRequest,
  TopUpResult,
  TopUpStatusResult,
} from "./types";

export {
  bay2gameSupplier,
  Bay2GameSupplier,
  khmerTopupSupplier,
  KhmerTopupSupplier,
  frozenyukiSupplier,
  FrozenYukiSupplier,
  normalizeBay2GameStatus,
  normalizeKhmerTopupStatus,
  normalizeFrozenYukiStatus,
};

const suppliers: Record<string, TopupSupplier> = {
  bay2game: bay2gameSupplier,
  khmer_topup: khmerTopupSupplier,
  frozenyuki: frozenyukiSupplier,
  soratopup: frozenyukiSupplier,
};

/**
 * Get the topup supplier instance.
 * Defaults to "bay2game" for backward compatibility.
 */
export function getSupplier(supplierName?: string | null): TopupSupplier {
  if (!supplierName) return bay2gameSupplier;
  const key = supplierName.trim().toLowerCase();
  return suppliers[key] || bay2gameSupplier;
}

/**
 * Create a game top-up for an already-PAID order.
 * Routes automatically to the configured supplier (Bay2Game or Khmer TopUp).
 */
export async function createTopup(req: TopUpRequest): Promise<TopUpResult> {
  const supplier = getSupplier(req.supplier);
  return supplier.createOrder({
    productCode: req.productCode,
    playerId: req.userId,
    serverId: req.zoneId,
    orderReference: req.reference,
  });
}

/**
 * Check top-up status with the provider by reference or supplier order code.
 */
export async function getTopupStatus(
  reference: string,
  supplierName?: string | null
): Promise<TopUpStatusResult> {
  const supplier = getSupplier(supplierName);
  if (supplier.checkOrder) {
    return supplier.checkOrder(reference);
  }
  return bay2gameGetTopupStatus(reference);
}

/**
 * Check provider merchant balance.
 */
export async function getBalance(supplierName?: string | null): Promise<TopupBalanceResult> {
  const supplier = getSupplier(supplierName);
  if (supplier.getBalance) {
    return supplier.getBalance();
  }
  return bay2gameGetBalance();
}

/**
 * All active game categories for a provider.
 */
export async function getCategories(supplierName?: string | null) {
  const supplier = getSupplier(supplierName);
  if (supplier.getCategories) {
    return supplier.getCategories();
  }
  return bay2gameGetCategories();
}

/**
 * Products/packages for a game from a provider.
 */
export async function getProducts(gameCode: string, supplierName?: string | null) {
  const supplier = getSupplier(supplierName);
  if (supplier.getProducts) {
    return supplier.getProducts(gameCode);
  }
  return bay2gameGetProducts(gameCode);
}

