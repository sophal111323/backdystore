/**
 * lib/env.ts — Startup environment validation
 * Validates all required env vars; allows Next.js build phase to compile in CI/Docker containers.
 */

import { z } from "zod";

function die(msg: string): never {
  console.error(`[env] FATAL: ${msg}`);
  throw new Error(msg);
}

const isProduction = process.env.NODE_ENV === "production";
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build" ||
  process.env.CI === "true" ||
  !process.env.DATABASE_URL;

// --- Block simulation mode in production ---
if (isProduction && !isBuildPhase && process.env.PAYMENT_SIMULATION_MODE === "true") {
  die(
    "PAYMENT_SIMULATION_MODE=true is NOT allowed in production. " +
      "Remove it from your production environment and configure real Tola Saint credentials."
  );
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(10, "DATABASE_URL is required"),
  ADMIN_JWT_SECRET: z
    .string()
    .min(32, "ADMIN_JWT_SECRET must be at least 32 characters"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const productionRequiredSchema = z.object({
  TOLA_SAINT_API_KEY: z
    .string()
    .min(1, "TOLA_SAINT_API_KEY is required in production"),
  TOLA_SAINT_WEBHOOK_SECRET: z
    .string()
    .min(16, "TOLA_SAINT_WEBHOOK_SECRET must be at least 16 chars in production"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
    .join("\n");

  if (isBuildPhase) {
    console.warn(`[env] Notice: Missing environment variables during build phase (will be loaded at runtime):\n${issues}`);
  } else {
    die(`Missing or invalid environment variables:\n${issues}`);
  }
}

if (isProduction && !isBuildPhase) {
  const prodParsed = productionRequiredSchema.safeParse(process.env);
  if (!prodParsed.success) {
    const issues = prodParsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    die(`Missing production environment variables:\n${issues}`);
  }
}

export const env = parsed.success
  ? parsed.data
  : {
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy",
      ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET || "dummy_jwt_secret_for_static_build_phase_min_32_characters",
      NODE_ENV: "production" as const,
    };

