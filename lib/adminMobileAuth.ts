import crypto from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getIp";
import type { Admin } from "@prisma/client";

export const DEFAULT_ADMIN_CHALLENGE_TTL_SECONDS = 5 * 60;
export const DEFAULT_ADMIN_MOBILE_SESSION_TTL_SECONDS = 8 * 60 * 60;

export type SafeAdminProfile = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

function positiveIntFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

export function getAdminChallengeTtlSeconds() {
  return positiveIntFromEnv(
    "ADMIN_LOGIN_CHALLENGE_TTL_SECONDS",
    DEFAULT_ADMIN_CHALLENGE_TTL_SECONDS
  );
}

export function getAdminMobileSessionTtlSeconds() {
  return positiveIntFromEnv(
    "ADMIN_MOBILE_SESSION_TTL_SECONDS",
    DEFAULT_ADMIN_MOBILE_SESSION_TTL_SECONDS
  );
}

export function safeAdminProfile(admin: Pick<Admin, "id" | "email" | "name" | "role">): SafeAdminProfile {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name ?? null,
    role: admin.role === "SUPERADMIN" ? "OWNER" : admin.role,
  };
}

export function isAllowedAdminRole(role: string) {
  // SUPERADMIN is kept for backward compatibility with the existing website.
  // OWNER is the new Flutter-facing equivalent.
  return role === "ADMIN" || role === "SUPERADMIN" || role === "OWNER" || role === "SUPPORT";
}

export function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  const fallbackToken = req.headers.get("x-admin-session-token")?.trim();
  if (!header) return fallbackToken || null;

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || fallbackToken || null;
}

export function hashAdminSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createRawAdminSessionToken() {
  return `jasmin_admin_${crypto.randomBytes(32).toString("hex")}`;
}

export async function createAdminLoginChallenge(adminId: string, req: NextRequest) {
  const ttlSeconds = getAdminChallengeTtlSeconds();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || null;

  // Keep the table clean and invalidate older unused challenges for this admin.
  await prisma.adminLoginChallenge.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { adminId, usedAt: null },
      ],
    },
  });

  return prisma.adminLoginChallenge.create({
    data: {
      adminId,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });
}

export async function createAdminMobileSession(adminId: string, req: NextRequest) {
  const token = createRawAdminSessionToken();
  const tokenHash = hashAdminSessionToken(token);
  const ttlSeconds = getAdminMobileSessionTtlSeconds();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || null;

  await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  // Keep old/expired sessions from growing forever.
  prisma.adminSession
    .deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          { revokedAt: { not: null }, expiresAt: { lt: new Date() } },
        ],
      },
    })
    .catch(() => {});

  return { token, expiresAt };
}

export async function getAdminFromBearerToken(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return null;

  const tokenHash = hashAdminSessionToken(token);
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash },
    include: { admin: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt <= new Date()) return null;
  if (!session.admin.active) return null;
  if (!isAllowedAdminRole(session.admin.role)) return null;

  // Do not block the request if this bookkeeping update fails.
  prisma.adminSession
    .update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return session.admin;
}

export async function revokeAdminBearerSession(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return false;

  const tokenHash = hashAdminSessionToken(token);
  const result = await prisma.adminSession.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return result.count > 0;
}
