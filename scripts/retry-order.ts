// scripts/retry-order.ts
// Re-runs auto fulfillment for a specific PAID order using the FIXED
// createTopup code. Safe: same unique reference, idempotency guards apply.
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { fulfillPaidOrder } = await import("../lib/fulfillment");
  const orderNumber = process.argv[2];
  if (!orderNumber) {
    console.error("Usage: npx tsx scripts/retry-order.ts <ORDER-NUMBER>");
    process.exit(1);
  }
  console.log(`Retrying fulfillment for ${orderNumber} ...`);
  const result = await fulfillPaidOrder(orderNumber.toUpperCase());
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
