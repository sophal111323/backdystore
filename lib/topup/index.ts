// lib/topup/index.ts
//
// Generic game top-up API. The rest of the app calls ONLY these functions —
// never the provider directly. Swapping providers later means editing this
// file and lib/topup/providers/*.

import { createTopup as bay2gameCreateTopup } from "./providers/bay2game";
import type { TopUpRequest, TopUpResult } from "./types";

export type { TopUpRequest, TopUpResult } from "./types";
export {
  normalizeBay2GameStatus,
  getBalance,
  getCategories,
  getProducts,
  getTopupStatus,
} from "./providers/bay2game";

/**
 * Create a game top-up for an already-PAID order.
 * The reference must be unique — callers always pass the order number.
 */
export async function createTopup(req: TopUpRequest): Promise<TopUpResult> {
  return bay2gameCreateTopup(req);
}
