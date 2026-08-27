// app/api/admin/topup/balance/route.ts
//
// Admin-only topup supplier balance check (Bay2Game / Khmer TopUp).
// GET /api/admin/topup/balance?provider=bay2game|khmer_topup

import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { getBalance, getSupplier } from "@/lib/topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cacheMap = new Map<string, { at: number; data: any }>();
const CACHE_MS = 30_000;

export const GET = withAdminAuth(async (req: NextRequest) => {
  const provider = (req.nextUrl.searchParams.get("provider") || "bay2game").toLowerCase();
  const supplier = getSupplier(provider);

  const cached = cacheMap.get(supplier.name);
  if (cached && Date.now() - cached.at < CACHE_MS && cached.data) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  const result = await getBalance(supplier.name);

  const payload = {
    ok: result.success,
    provider: supplier.name,
    displayName: supplier.displayName,
    balance: result.balance ?? null,
    currency: result.currency || "USD",
    username: result.username ?? null,
    totalOrders: result.totalOrders ?? null,
    totalSpent: result.totalSpent ?? null,
    error: result.error ?? null,
    lastUpdated: new Date().toISOString(),
    cached: false,
  };

  if (result.success) {
    cacheMap.set(supplier.name, { at: Date.now(), data: payload });
  }

  return NextResponse.json(payload);
});

