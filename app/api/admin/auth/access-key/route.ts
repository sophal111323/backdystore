/**
 * /api/admin/auth/access-key — login step 2 of 3 (password → access key → 2FA)
 *
 * Step 1 (POST /api/admin/auth) issues the admin_key_pending cookie, and only
 * this route can exchange it for the admin_2fa_pending cookie that step 3
 * (POST /api/admin/auth/2fa) demands. Each stage accepts exactly one token type
 * and mints only the next one, so no step can be skipped.
 *
 * The submitted key is compared and dropped. It is never logged, audited, or
 * echoed back.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";

import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getIp";
import { applyRateLimit } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/secureLogger";
import { getLockDurationMs, formatLockDuration } from "@/lib/lockPolicy";
import { writeAuditForAdmin } from "@/lib/audit";
import { adminApiErrorResponse } from "@/lib/adminApiError";
import { ADMIN_COOKIE_NAME } from "@/lib/auth";
import {
  ACCESS_KEY_PENDING_COOKIE,
  ACCESS_KEY_PENDING_TYPE,
  isAccessKeyConfigured,
  verifyAccessKey,
  verifyAccessKeyDetailed,
} from "@/lib/accessKey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PENDING_2FA_COOKIE = "admin_2fa_pending";
const PENDING_2FA_TYPE = "admin-2fa-pending";
const DEFAULT_PENDING_TTL_SECONDS = 5 * 60;

// Bounded so an oversized body is rejected before any hashing work. The key is
// 1000 chars; the ceiling leaves room for a longer one after a rotation.
const accessKeySchema = z.object({
  accessKey: z.string().min(1).max(4096),
});

type PendingPayload = {
  type?: string;
  adminId?: string;
  email?: string;
};

function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET is not set");
  return secret;
}

function getPendingTtlSeconds() {
  const ttl = Number(
    process.env.ADMIN_2FA_TTL_SECONDS || DEFAULT_PENDING_TTL_SECONDS
  );

  if (!Number.isFinite(ttl) || ttl <= 0) return DEFAULT_PENDING_TTL_SECONDS;
  return Math.floor(ttl);
}

function readPendingKeyToken(req: NextRequest): PendingPayload | null {
  const token = req.cookies.get(ACCESS_KEY_PENDING_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getAdminJwtSecret()) as PendingPayload;
    if (payload?.type !== ACCESS_KEY_PENDING_TYPE) return null;
    if (!payload.adminId || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
};

function clearPendingKeyCookie(res: NextResponse) {
  res.cookies.set(ACCESS_KEY_PENDING_COOKIE, "", {
    ...COOKIE_OPTS,
    maxAge: 0,
    expires: new Date(0),
  });
}

function expiredResponse() {
  const res = NextResponse.json(
    { error: "Login session expired. Please start again.", step: "login" },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );

  clearPendingKeyCookie(res);
  return res;
}

// ── GET: report whether this browser is mid-chain, so a refresh resumes ─────
export async function GET(req: NextRequest) {
  try {
    const payload = readPendingKeyToken(req);

    if (!payload?.adminId) {
      return NextResponse.json(
        { step: "login", locked: false },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const lock = await prisma.adminAuthLock.findUnique({
      where: { identifier: `admin-access-key:${payload.adminId}` },
    });

    if (lock?.forever) {
      return NextResponse.json(
        { step: "accessKey", locked: true, forever: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
      const remainingMs = lock.lockedUntil.getTime() - Date.now();

      return NextResponse.json(
        {
          step: "accessKey",
          locked: true,
          forever: false,
          lockedUntil: lock.lockedUntil,
          retryAfter: formatLockDuration(remainingMs),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { step: "accessKey", locked: false, email: payload.email },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Admin access key status error:", error);
    return adminApiErrorResponse(error);
  }
}

// ── POST: verify the access key → issue the pending-2FA cookie ──────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    // Same budget as the password step: 10 attempts per IP per 15 minutes.
    const rl = await applyRateLimit(
      `admin-access-key:${ip}`,
      10,
      15 * 60 * 1000,
      ip
    );

    if (rl) return rl;

    const payload = readPendingKeyToken(req);
    if (!payload?.adminId || !payload.email) return expiredResponse();

    const identifier = `admin-access-key:${payload.adminId}`;
    const lock = await prisma.adminAuthLock.findUnique({
      where: { identifier },
    });

    if (lock?.forever) {
      return NextResponse.json(
        { error: "Account is disabled. Contact the site owner." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
      const remainingMs = lock.lockedUntil.getTime() - Date.now();

      return NextResponse.json(
        {
          error: `Too many failed attempts. Please try again in ${formatLockDuration(
            remainingMs
          )}.`,
          lockedUntil: lock.lockedUntil,
          retryAfter: formatLockDuration(remainingMs),
        },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = accessKeySchema.safeParse(body);

    // Re-read the admin instead of trusting step 1: the account may have been
    // deactivated between the password step and this one.
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });

    if (!admin || !admin.active) return expiredResponse();

    if (!isAccessKeyConfigured()) {
      logSecurityEvent({
        event: "admin_access_key_not_configured",
        ip,
        adminId: admin.id,
      });

      return NextResponse.json(
        {
          error:
            "Access key is not configured on the server. Contact the site owner.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!parsed.success) {
      return handleKeyFail(req, admin, identifier, lock?.failCount ?? 0, ip);
    }

    const verification = await verifyAccessKeyDetailed(parsed.data.accessKey, admin.id);

    if (!verification.valid) {
      if (verification.reason === "expired") {
        return NextResponse.json(
          {
            error: "Access Key នេះបានផុតកំណត់ហើយ (លើសពី 1 ម៉ោង)។ សូមចុចផ្ញើកូដសារជាថ្មី។",
            expired: true,
          },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      return handleKeyFail(req, admin, identifier, lock?.failCount ?? 0, ip);
    }

    await prisma.adminAuthLock.deleteMany({ where: { identifier } });

    logSecurityEvent({
      event: "admin_access_key_success",
      ip,
      adminId: admin.id,
      detail: admin.email,
    });

    await writeAuditForAdmin(admin, req, {
      action: "admin_access_key_success",
      targetType: "Admin",
      targetId: admin.id,
      details: { requires2FA: !!admin.totpSecret },
    });

    if (admin.totpSecret) {
      const ttlSeconds = getPendingTtlSeconds();
      const pendingToken = jwt.sign(
        {
          type: PENDING_2FA_TYPE,
          adminId: String(admin.id),
          email: admin.email,
        },
        getAdminJwtSecret(),
        { expiresIn: ttlSeconds }
      );

      const res = NextResponse.json(
        {
          ok: true,
          requires2FA: true,
          email: admin.email,
          message: "Access key ត្រឹមត្រូវ។ សូមបញ្ចូលកូដ 2FA។",
        },
        { headers: { "Cache-Control": "no-store" } }
      );

      res.cookies.set(PENDING_2FA_COOKIE, pendingToken, {
        ...COOKIE_OPTS,
        maxAge: ttlSeconds,
      });

      clearPendingKeyCookie(res);
      return res;
    }

    // No TOTP enrolled, so there is no third step to enforce and this admin is
    // logged in here — one step later than before this route existed, never
    // earlier. Enrolling TOTP restores the full three-step chain.
    const sessionToken = jwt.sign(
      {
        adminId: String(admin.id),
        email: admin.email,
        role: admin.role,
      },
      getAdminJwtSecret(),
      { expiresIn: "7d" }
    );

    const res = NextResponse.json(
      {
        ok: true,
        requires2FA: false,
        email: admin.email,
        message: "ចូលប្រព័ន្ធបានជោគជ័យ!",
      },
      { headers: { "Cache-Control": "no-store" } }
    );

    res.cookies.set(ADMIN_COOKIE_NAME, sessionToken, {
      ...COOKIE_OPTS,
      maxAge: 7 * 24 * 60 * 60,
    });

    clearPendingKeyCookie(res);
    return res;
  } catch (error) {
    console.error("Admin access key error:", error);
    return adminApiErrorResponse(error);
  }
}

/**
 * Applies the same progressive lock schedule as the password and 2FA steps.
 * The submitted key is deliberately not a parameter, so it cannot reach a log
 * line or an audit row from here.
 */
async function handleKeyFail(
  req: NextRequest,
  admin: { id: string; email: string },
  identifier: string,
  currentFailCount: number,
  ip: string
) {
  const nextFail = currentFailCount + 1;
  const durationMs = getLockDurationMs(nextFail);
  const isLocked = durationMs > 0;
  const lockedUntil = isLocked ? new Date(Date.now() + durationMs) : null;

  logSecurityEvent({
    event: "admin_access_key_fail",
    ip,
    adminId: admin.id,
    failCount: nextFail,
    lockDuration: isLocked ? formatLockDuration(durationMs) : "none",
  });

  await prisma.adminAuthLock.upsert({
    where: { identifier },
    update: { failCount: nextFail, lockedUntil, forever: false },
    create: { identifier, failCount: nextFail, lockedUntil, forever: false },
  });

  await writeAuditForAdmin(admin, req, {
    action: "admin_access_key_failed",
    targetType: "Admin",
    targetId: admin.id,
    details: { failCount: nextFail },
  });

  if (isLocked && lockedUntil) {
    const remainingMs = lockedUntil.getTime() - Date.now();

    return NextResponse.json(
      {
        error: `Access key មិនត្រឹមត្រូវ។ គណនីត្រូវ lock រយៈពេល ${formatLockDuration(
          remainingMs
        )}។`,
        lockedUntil,
        retryAfter: formatLockDuration(remainingMs),
        attemptsRemaining: 0,
      },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  const remainingAttempts = Math.max(0, 3 - nextFail);

  return NextResponse.json(
    {
      error: `Access key មិនត្រឹមត្រូវ។ (នៅសល់ ${remainingAttempts} លើកទៀត មុនពេល lock)`,
      attemptsRemaining: remainingAttempts,
    },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}
