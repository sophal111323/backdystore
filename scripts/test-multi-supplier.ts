// scripts/test-multi-supplier.ts
import { readFileSync } from "node:fs";

// Load .env
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { getSupplier, getBalance, createTopup } = await import("../lib/topup");
  const { prisma } = await import("../lib/prisma");

  console.log("=== 1. Testing Supplier Registry & Factory ===");
  const b2g = getSupplier("bay2game");
  console.log("getSupplier('bay2game') ->", b2g.name, `(${b2g.displayName})`);

  const kt = getSupplier("khmer_topup");
  console.log("getSupplier('khmer_topup') ->", kt.name, `(${kt.displayName})`);

  const def = getSupplier();
  console.log("getSupplier() [default] ->", def.name, `(${def.displayName})`);

  console.log("\n=== 2. Testing Database Schema & Product Supplier Field ===");
  const sampleProducts = await prisma.product.findMany({
    take: 5,
    select: { id: true, name: true, supplier: true, supplierCode: true },
  });
  console.log("Sample products in database:");
  for (const p of sampleProducts) {
    console.log(`  - [${p.supplier}] ${p.name} (code: ${p.supplierCode ?? "none"})`);
  }

  console.log("\n=== 3. Testing Provider Balance API ===");
  console.log("Checking Bay2Game balance...");
  const b2gBal = await getBalance("bay2game");
  console.log("Bay2Game Balance result:", JSON.stringify(b2gBal, null, 2));

  console.log("Checking Khmer TopUp balance...");
  const ktBal = await getBalance("khmer_topup");
  console.log("Khmer TopUp Balance result:", JSON.stringify(ktBal, null, 2));

  console.log("\n=== 4. Testing Khmer TopUp Validation Handling ===");
  const testInvalidPkg = await kt.createOrder({
    productCode: "INVALID_CODE",
    playerId: "123456",
    orderReference: "TEST-REF-001",
  });
  console.log("Non-numeric package ID validation:", testInvalidPkg);

  console.log("\nMulti-supplier routing tests completed successfully!");
}

main()
  .catch((e) => {
    console.error("Test error:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
