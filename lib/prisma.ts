import "@/lib/env";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  try {
    const client = new PrismaClient({
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