/**
 * prisma/seed.ts — Database seeder
 *
 * Changes:
 * - Removed hardcoded fallback password
 * - Requires ADMIN_EMAIL and ADMIN_PASSWORD from environment
 * - Never logs the real password
 * - Enforces minimum password strength
 * - Removed Genshin Impact, Call of Duty: Mobile, Honkai: Star Rail
 * - Fixed product duplicate issue by setting stable product ID
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("⚡ Seeding JASMINTOPUP database...");

  // --- Settings singleton ---
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      siteName: "JASMINTOPUP",
      exchangeRate: 4100,
      supportTelegram: "@jasmintopup",
      supportEmail: "support@jasmintopup.com",
    },
  });

  // --- Admin user ---
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail) {
    throw new Error(
      "ADMIN_EMAIL environment variable is required. Set it before running the seed."
    );
  }

  if (!adminPassword) {
    throw new Error(
      "ADMIN_PASSWORD environment variable is required. Set it before running the seed."
    );
  }

  if (adminPassword.length < 12) {
    throw new Error(
      "ADMIN_PASSWORD must be at least 12 characters for security."
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: "Super Admin",
      role: "SUPERADMIN",
    },
  });

  console.log(`✅ Admin created/verified: ${adminEmail} (password set, not logged)`);

  // --- Games ---
  const games = [
    {
      slug: "mobile-legends",
      name: "Mobile Legends: Bang Bang",
      publisher: "Moonton",
      description: "Top up Diamonds instantly for Mobile Legends",
      imageUrl: "https://cdn.rithtopup.com/games/mlbb.jpg",
      bannerUrl: "https://cdn.rithtopup.com/banners/mlbb.jpg",
      currencyName: "Diamonds",
      uidLabel: "User ID (Zone ID)",
      uidExample: "12345678",
      featured: true,
      sortOrder: 1,
      products: [
        { name: "11 Diamonds", amount: 11, priceUsd: 0.25 },
        { name: "22 Diamonds", amount: 22, priceUsd: 0.5 },
        { name: "56 Diamonds", amount: 56, priceUsd: 1.1 },
        { name: "86 Diamonds", amount: 86, bonus: 0, priceUsd: 1.8, badge: "Hot" },
        { name: "172 Diamonds", amount: 172, bonus: 0, priceUsd: 3.5 },
        { name: "706 Diamonds", amount: 706, bonus: 0, priceUsd: 13.8, badge: "Best Value" },
      ],
    },
    {
      slug: "free-fire",
      name: "Garena Free Fire",
      publisher: "Garena",
      description: "Top up Diamonds for Free Fire MAX and Free Fire",
      imageUrl: "https://cdn.rithtopup.com/games/freefire.jpg",
      bannerUrl: "https://cdn.rithtopup.com/banners/freefire.jpg",
      currencyName: "Diamonds",
      uidLabel: "Player ID",
      uidExample: "1234567890",
      featured: true,
      sortOrder: 2,
      products: [
        { name: "100 Diamonds", amount: 100, priceUsd: 0.99 },
        { name: "210 Diamonds", amount: 210, priceUsd: 1.98 },
        { name: "530 Diamonds", amount: 530, priceUsd: 4.95, badge: "Hot" },
        { name: "1080 Diamonds", amount: 1080, priceUsd: 9.9 },
        { name: "2200 Diamonds", amount: 2200, priceUsd: 19.8, badge: "Best Value" },
        { name: "5600 Diamonds", amount: 5600, priceUsd: 49.5 },
        { name: "Weekly Membership", amount: 0, priceUsd: 1.5, badge: "Pass" },
        { name: "Monthly Membership", amount: 0, priceUsd: 7.9, badge: "Pass" },
      ],
    },
    {
      slug: "pubg-mobile",
      name: "PUBG Mobile",
      publisher: "Tencent",
      description: "Top up UC for PUBG Mobile Global and KR",
      imageUrl: "https://cdn.rithtopup.com/games/pubgm.jpg",
      bannerUrl: "https://cdn.rithtopup.com/banners/pubgm.jpg",
      currencyName: "UC",
      uidLabel: "Player ID",
      uidExample: "5123456789",
      featured: true,
      sortOrder: 3,
      products: [
        { name: "60 UC", amount: 60, priceUsd: 0.99 },
        { name: "325 UC", amount: 325, priceUsd: 4.99 },
        { name: "660 UC", amount: 660, bonus: 60, priceUsd: 9.99, badge: "Hot" },
        { name: "1800 UC", amount: 1800, bonus: 300, priceUsd: 24.99 },
        { name: "3850 UC", amount: 3850, bonus: 850, priceUsd: 49.99, badge: "Best Value" },
        { name: "8100 UC", amount: 8100, bonus: 2100, priceUsd: 99.99 },
      ],
    },
  ];

  for (const game of games) {
    const { products, ...gameData } = game;

    const created = await prisma.game.upsert({
      where: { slug: game.slug },
      update: gameData,
      create: gameData,
    });

    for (const prod of products) {
      const productId = `${created.id}-${prod.name
        .toLowerCase()
        .replace(/\+/g, "plus")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`;

      await prisma.product.upsert({
        where: { id: productId },
        update: prod,
        create: {
          id: productId,
          ...prod,
          gameId: created.id,
        },
      });
    }

    console.log(`✅ Game seeded: ${game.name}`);
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });