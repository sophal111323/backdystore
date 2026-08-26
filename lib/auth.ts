/**
 * lib/auth.ts — Admin authentication helpers
 *
 * Web admin continues to use the HttpOnly admin_token cookie.
 * Flutter/mobile admin can use a Bearer token verified from AdminSession.
 */

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { getAdminFromBearerToken, isAllowedAdminRole } from "@/lib/adminMobileAuth";

const ADMIN_COOKIE_NAME = "admin_token";

// Reduced from 7 days to 8 hours (Issue #7)
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET is not set");
  }
  return secret;
}

export function signAdminToken(adminId: string) {
  return jwt.sign({ adminId }, getAdminJwtSecret(), {
    expiresIn: SESSION_MAX_AGE_SECONDS,
  });
}

export function verifyAdminToken(token: string) {
  try {
    return jwt.verify(token, getAdminJwtSecret()) as {
      adminId: string;
      iat: number;
      exp: number;
    };
  } catch {
    return null;
  }
}

export function buildAuthCookie(token: string) {
  const isProduction = process.env.NODE_ENV === "production";

  return [
    `${ADMIN_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    isProduction ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildClearCookie() {
  const isProduction = process.env.NODE_ENV === "production";

  return [
    `${ADMIN_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
    isProduction ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Returns the current web admin from the HttpOnly cookie.
 * Returns null for any failure — callers must treat null as unauthorized.
 */
export async function getCurrentAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = verifyAdminToken(token);
    if (!payload) return null;

    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });

    if (!admin) return null;
    if (!admin.active) return null;
    if (!isAllowedAdminRole(admin.role)) return null;

    return admin;
  } catch {
    return null;
  }
}

/**
 * Returns the current admin from either:
 * 1. Flutter/mobile Bearer token, or
 * 2. Existing web admin HttpOnly cookie.
 *
 * Bearer token is checked first so mobile API calls can reuse existing admin APIs.
 */
export async function getCurrentAdminFromRequest(req: NextRequest) {
  const bearerAdmin = await getAdminFromBearerToken(req).catch(() => null);
  if (bearerAdmin) return bearerAdmin;

  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  const bearerToken = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearerToken) {
    const payload = verifyAdminToken(bearerToken);
    if (payload?.adminId) {
      const admin = await prisma.admin.findUnique({
        where: { id: payload.adminId },
      });

      if (admin?.active && isAllowedAdminRole(admin.role)) {
        return admin;
      }
    }
  }

  return getCurrentAdmin();
}

export { ADMIN_COOKIE_NAME, SESSION_MAX_AGE_SECONDS };
