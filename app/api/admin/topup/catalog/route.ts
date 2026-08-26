// app/api/admin/topup/catalog/route.ts
//
// Admin-only Bay2Game catalog lookup — helps map website products to
// Bay2Game codes.
//
//   GET /api/admin/topup/catalog                 → game categories
//   GET /api/admin/topup/catalog?game_code=mlbb_exclusive → products
//
// Uses only documented endpoints (/categories, /products).

import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { getCategories, getProducts } from "@/lib/topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async (req: NextRequest) => {
  const gameCode = req.nextUrl.searchParams.get("game_code")?.trim();

  if (gameCode) {
    const products = await getProducts(gameCode);
    return NextResponse.json({ provider: "bay2game", game_code: gameCode, ...products });
  }

  const categories = await getCategories();
  return NextResponse.json({ provider: "bay2game", ...categories });
});
