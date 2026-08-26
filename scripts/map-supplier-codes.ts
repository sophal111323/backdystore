// scripts/map-supplier-codes.ts
// Lists local products missing supplierCode + matching Bay2Game catalog entries.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const prisma = new PrismaClient();
const BASE = (process.env.BAY2GAME_BASE_URL || "https://api.bay2game.xyz/api").replace(/^['"]|['"]$/g, "");
const KEY = (process.env.BAY2GAME_API_KEY || "").trim().replace(/^['"]|['"]$/g, "");

async function call(endpoint: string, extra: Record<string, string> = {}) {
  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set("api_key", KEY);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  return res.json();
}

async function main() {
  // 1. Local products missing supplierCode
  const missing = await prisma.product.findMany({
    where: { supplierCode: null },
    include: { game: true },
    orderBy: [{ game: { name: "asc" } }, { sortOrder: "asc" }],
  });
  console.log("=== PRODUCTS MISSING supplierCode ===");
  for (const p of missing) {
    console.log(`  [${p.game.name}] "${p.name}" ($${p.priceUsd.toFixed(2)}) id=${p.id}`);
  }

  // 2. Search provider catalog
  const cats = await call("/categories");
  const pubgGames = (cats?.categories ?? []).filter((g: any) =>
    String(g.name || "").toLowerCase().includes("pubg")
  );
  for (const g of pubgGames) {
    console.log(`\n-- PROVIDER GAME: ${g.game_code} → ${g.name}`);
    const prods = await call("/products", { game_code: g.game_code });
    for (const p of prods?.products ?? []) {
      console.log(`   ${p.product_code} | ${p.name} | $${p.sell_price} | ${p.status}`);
    }
  }
}




main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
