import "@/lib/env";

import { neonConfig, Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

// Enable WebSocket support for Neon serverless driver in Node.js
if (typeof ws !== "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    try {
      console.log("[prisma] Initializing Neon adapter with Pool...");
      const pool = new Pool({ connectionString });
      const adapter = new PrismaNeon(pool);
      console.log("[prisma] Neon adapter created successfully!");
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
      } as any);
    } catch (err) {
      console.error("[prisma] ERROR creating Neon adapter:", err);
    }
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;