// app/api/admin/topup/catalog/route.ts
//
// Admin-only topup supplier catalog lookup (Bay2Game / Khmer TopUp).
//
//   GET /api/admin/topup/catalog?provider=bay2game|khmer_topup
//   GET /api/admin/topup/catalog?provider=bay2game&game_code=mlbb_exclusive

import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { getCategories, getProducts, getSupplier } from "@/lib/topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async (req: NextRequest) => {
  const provider = (req.nextUrl.searchParams.get("provider") || "bay2game").toLowerCase();
  const gameCode = req.nextUrl.searchParams.get("game_code")?.trim();
  const supplier = getSupplier(provider);

  if (gameCode) {
    const products = await getProducts(gameCode, supplier.name);
    return NextResponse.json({
      provider: supplier.name,
      displayName: supplier.displayName,
      game_code: gameCode,
      ...products,
    });
  }

  const categories = await getCategories(supplier.name);
  return NextResponse.json({
    provider: supplier.name,
    displayName: supplier.displayName,
    ...categories,
  });
});

