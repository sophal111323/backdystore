// scripts/diagnose-delivery.ts
// Read-only diagnostic: checks recent orders + product supplier codes.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      orderNumber: true,
      status: true,
      topupStatus: true,
      topupProvider: true,
      topupProviderRef: true,
      failureReason: true,
      deliveryNote: true,
      paymentRef: true,
      amountUsd: true,
      playerUid: true,
      paidAt: true,
      createdAt: true,
      product: { select: { name: true, supplierCode: true } },
    },
  });

  console.log("=== LAST 10 ORDERS ===");
  for (const o of orders) {
    console.log(
      [
        `#${o.orderNumber}`,
        `status=${o.status}`,
        `topup=${o.topupStatus ?? "-"}`,
        `providerRef=${o.topupProviderRef ?? "NONE"}`,
        `paymentRef=${o.paymentRef ? "SET" : "MISSING"}`,
        `$${o.amountUsd.toFixed(2)}`,
        `supplierCode=${o.product.supplierCode ? o.product.supplierCode : "❌ MISSING"}`,
        o.failureReason ? `failure="${o.failureReason}"` : "",
        o.deliveryNote ? `note="${o.deliveryNote}"` : "",
        o.createdAt.toISOString(),
      ]
        .filter(Boolean)
        .join(" | ")
    );
  }

  const noCode = await prisma.product.count({
    where: { active: true, supplierCode: null },
  });
  console.log(`\nActive products WITHOUT supplierCode: ${noCode}`);
}

main()
  .catch((e) => {
    console.error("Diagnostic failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
