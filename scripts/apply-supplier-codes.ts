// scripts/apply-supplier-codes.ts
// Applies VERIFIED Bay2Game product codes to local products (exact matches
// only — same denomination). Run once.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const prisma = new PrismaClient();

// Verified against https://api.bay2game.xyz/api on 2026-08-26:
const MAPPING: Record<string, string> = {
  // PUBG Mobile → game_code "pubgm" (exact denominations)
  "cmt9uwvtd0003ez0upz1cgw7d-60-uc": "PUBGM_60",
  "cmt9uwvtd0003ez0upz1cgw7d-325-uc": "PUBGM_325",
  "cmt9uwvtd0003ez0upz1cgw7d-660-uc": "PUBGM_660",
  "cmt9uwvtd0003ez0upz1cgw7d-1800-uc": "PUBGM_1800",
  "cmt9uwvtd0003ez0upz1cgw7d-3850-uc": "PUBGM_3850",
  "cmt9uwvtd0003ez0upz1cgw7d-8100-uc": "PUBGM_8100",
  // Garena Free Fire → game_code "freefire_sg" (exact denominations)
  "cmt9uwtr60002ez0ubafkqftm-100-diamonds": "FREEFIRE_SG_100",
  "cmt9uwtr60002ez0ubafkqftm-5600-diamonds": "FREEFIRE_SG_5600",
};

async function main() {
  for (const [id, code] of Object.entries(MAPPING)) {
    const p = await prisma.product.findUnique({ where: { id } });
    if (!p) {
      console.log(`SKIP ${code}: product ${id} not found`);
      continue;
    }
    if (p.supplierCode && p.supplierCode !== code) {
      console.log(`SKIP ${p.name}: already has supplierCode=${p.supplierCode}`);
      continue;
    }
    await prisma.product.update({ where: { id }, data: { supplierCode: code } });
    console.log(`SET ${p.name} → ${code}`);
  }

  const remaining = await prisma.product.count({ where: { supplierCode: null } });
  console.log(`\nProducts still missing supplierCode: ${remaining}`);
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
