// app/api/admin/topup/balance/route.ts
//
// Admin-only Bay2Game balance check.
// GET /api/admin/topup/balance
//
// Calls the documented GET /profile endpoint and returns balance + stats.
// Never exposes the API key. Short in-memory cache to avoid hammering the
// provider when admins refresh repeatedly.

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { getBalance } from "@/lib/topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cache: { at: number; data: ReturnType<typeof JSON.parse> | null } | null = null;
const CACHE_MS = 30_000;

export const GET = withAdminAuth(async () => {
  if (cache && Date.now() - cache.at < CACHE_MS && cache.data) {
    return NextResponse.json({ ...cache.data, cached: true });
  }

  const result = await getBalance();

  const payload = {
    ok: result.success,
    provider: "bay2game",
    balance: result.balance ?? null,
    currency: result.currency,
    username: result.username ?? null,
    totalOrders: result.totalOrders ?? null,
    totalSpent: result.totalSpent ?? null,
    error: result.error ?? null,
    lastUpdated: new Date().toISOString(),
    cached: false,
  };

  if (result.success) {
    cache = { at: Date.now(), data: payload };
  }

  return NextResponse.json(payload);
});
