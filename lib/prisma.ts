import "@/lib/env";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  let dbUrl = process.env.DATABASE_URL;

  if (
    process.env.NODE_ENV === "development" &&
    dbUrl?.includes("dystore-ozbiosqbddea.db.upclouddatabases.com:11569")
  ) {
    dbUrl = dbUrl.replace("dystore-ozbiosqbddea.db.upclouddatabases.com:11569", "127.0.0.1:11569");
  }

  try {
    const client = new PrismaClient({
      datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
    globalForPrisma.prisma = client;
    return client;
  } catch (err: any) {
    console.error("[prisma] FATAL error creating PrismaClient:");
    console.error("Error message:", err?.message);
    console.error("Error stack:", err?.stack);
    throw err;
  }
}

// Lazy proxy so PrismaClient is only instantiated when first accessed
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const val = (client as any)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});