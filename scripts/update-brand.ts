import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {
      siteName: "DyTopup",
      supportTelegram: "@dytopup",
      supportTikTok: "@dytopup",
      supportEmail: "support@dytopup.com",
    },
    create: {
      id: 1,
      siteName: "DyTopup",
      exchangeRate: 4100,
      supportTelegram: "@dytopup",
      supportTikTok: "@dytopup",
      supportEmail: "support@dytopup.com",
    },
  });
  console.log("✅ Database siteName, email, and social handles updated to DyTopup!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
