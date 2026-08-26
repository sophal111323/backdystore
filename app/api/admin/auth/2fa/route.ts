/**
 * /api/admin/auth/2fa — TOTP-based Google Authenticator 2FA
 *
 * Supports both flows:
 * 1. Existing website flow: pending-2FA HttpOnly cookie → final admin_token cookie
 * 2. Flutter/mobile flow: challengeId in JSON → final Bearer session token
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";

import { getClientIp } from "@/lib/getIp";
import { prisma } from "@/lib/prisma";
import { signAdminToken, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/secureLogger";
import { getLockDurationMs, formatLockDuration } from "@/lib/lockPolicy";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { getRequestInfo, detectProvider } from "@/lib/requestInfo";
import { createAdminMobileSession, safeAdminProfile } from "@/lib/adminMobileAuth";
import { writeAuditForAdmin } from "@/lib/audit";
import { adminApiErrorResponse } from "@/lib/adminApiError";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// TOTP window: accept 1 step before/after (handles ~60s clock drift)
authenticator.options = { window: 1 };

const PENDING_2FA_COOKIE = "admin_2fa_pending";
const ADMIN_COOKIE_NAME = "admin_token";

const verifySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
  challengeId: z.string().min(8).optional(),
});

type Pending2FAPayload = {
  type?: string;
  adminId?: string;
  email?: string;
};

function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET is not set");
  return secret;
}

function decodePendingToken(token: string): Pending2FAPayload | null {
  try {
    return jwt.verify(token, getAdminJwtSecret()) as Pending2FAPayload;
  } catch {
    return null;
  }
}

// ── GET: check website 2FA lock / session status ────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const pendingToken = req.cookies.get(PENDING_2FA_COOKIE)?.value;

    if (!pendingToken) {
      return NextResponse.json({ step: "login", locked: false });
    }

    const payload = decodePendingToken(pendingToken);

    if (!payload?.adminId || payload.type !== "admin-2fa-pending") {
      return NextResponse.json({ step: "login", locked: false });
    }

    const identifier = `admin-2fa:${payload.adminId}`;
    const lock = await prisma.adminAuthLock.findUnique({ where: { identifier } });

    if (lock?.forever) {
      return NextResponse.json({ step: "2fa", locked: true, forever: true });
    }

    if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
      const remainingMs = lock.lockedUntil.getTime() - Date.now();
      return NextResponse.json({
        step: "2fa",
        locked: true,
        forever: false,
        lockedUntil: lock.lockedUntil,
        retryAfter: formatLockDuration(remainingMs),
      });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });

    return NextResponse.json({
      step: "2fa",
      locked: false,
      email: payload.email,
      totpConfigured: !!admin?.totpSecret,
    });
  } catch (error) {
    console.error("Admin 2FA status error:", error);
    return adminApiErrorResponse(error);
  }
}

// ── POST: verify TOTP code for website or Flutter/mobile ────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    const rl = await applyRateLimit(`2fa-verify:${ip}`, 10, 15 * 60 * 1000, ip);
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid 2FA code" }, { status: 400 });
    }

    if (parsed.data.challengeId) {
      return handleMobile2FA(req, parsed.data.challengeId, parsed.data.code.trim());
    }

    return handleWeb2FA(req, parsed.data.code.trim());
  } catch (error) {
    console.error("Admin 2FA error:", error);
    return adminApiErrorResponse(error);
  }
}

async function handleMobile2FA(req: NextRequest, challengeId: string, inputCode: string) {
  const ip = getClientIp(req);

  const challenge = await prisma.adminLoginChallenge.findUnique({
    where: { id: challengeId },
    include: { admin: true },
  });

  if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date()) {
    return NextResponse.json(
      { error: "2FA session expired. Please login again." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const admin = challenge.admin;
  const identifier = `admin-2fa:${admin.id}`;
  const lock = await prisma.adminAuthLock.findUnique({ where: { identifier } });

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
        error: `Too many failed attempts. Please try again in ${formatLockDuration(remainingMs)}.`,
        lockedUntil: lock.lockedUntil,
        retryAfter: formatLockDuration(remainingMs),
      },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!admin.active) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!admin.totpSecret) {
    return NextResponse.json(
      {
        error:
          "TOTP not configured. Please complete Google Authenticator setup before logging in.",
        needsSetup: true,
      },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const usedToken = await prisma.usedTotpToken.findUnique({
    where: { adminId_token: { adminId: admin.id, token: inputCode } },
  });

  if (usedToken) {
    return NextResponse.json(
      { error: "Code already used. Please wait for a new code." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const isValid = authenticator.verify({ token: inputCode, secret: admin.totpSecret });

  if (!isValid) {
    const nextFail = (lock?.failCount ?? 0) + 1;
    const durationMs = getLockDurationMs(nextFail);
    const lockedUntil = new Date(Date.now() + durationMs);

    await prisma.adminLoginChallenge.update({
      where: { id: challenge.id },
      data: { attemptCount: { increment: 1 } },
    });

    await prisma.adminAuthLock.upsert({
      where: { identifier },
      update: { failCount: nextFail, lockedUntil, forever: false },
      create: { identifier, failCount: nextFail, lockedUntil, forever: false },
    });

    logSecurityEvent({
      event: "admin_mobile_2fa_fail",
      adminId: admin.id,
      ip,
      failCount: nextFail,
      lockDuration: formatLockDuration(durationMs),
    });

    await writeAuditForAdmin(admin, req, {
      action: "admin_mobile_2fa_failed",
      targetType: "Admin",
      targetId: admin.id,
      details: { failCount: nextFail, challengeId: challenge.id },
    });

    const remainingMs = lockedUntil.getTime() - Date.now();
    return NextResponse.json(
      {
        error: `Invalid 2FA code. Please try again in ${formatLockDuration(remainingMs)}.`,
        lockedUntil,
        retryAfter: formatLockDuration(remainingMs),
      },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  await prisma.adminAuthLock.deleteMany({ where: { identifier } });
  await prisma.adminLoginChallenge.update({
    where: { id: challenge.id },
    data: { usedAt: new Date() },
  });
  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  await recordLoginInfo(req, admin.email, admin.id, "mobile");
  await storeUsedTotpToken(admin.id, inputCode);

  const session = await createAdminMobileSession(admin.id, req);
  const adminToken = signAdminToken(admin.id);

  logSecurityEvent({
    event: "admin_mobile_2fa_success",
    adminId: admin.id,
    ip,
  });

  await writeAuditForAdmin(admin, req, {
    action: "admin_mobile_2fa_success",
    targetType: "AdminSession",
    targetId: admin.id,
    details: { expiresAt: session.expiresAt },
  });

  return NextResponse.json(
    {
      token: adminToken,
      tokenType: "Bearer",
      expiresAt: session.expiresAt,
      mobileSessionToken: session.token,
      admin: safeAdminProfile(admin),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function handleWeb2FA(req: NextRequest, inputCode: string) {
  const ip = getClientIp(req);
  const pendingToken = req.cookies.get(PENDING_2FA_COOKIE)?.value;

  if (!pendingToken) {
    return NextResponse.json(
      { error: "2FA session expired. Please login again." },
      { status: 401 }
    );
  }

  const payload = decodePendingToken(pendingToken);
  if (
    !payload ||
    payload.type !== "admin-2fa-pending" ||
    !payload.adminId ||
    !payload.email
  ) {
    return NextResponse.json(
      { error: "2FA session expired. Please login again." },
      { status: 401 }
    );
  }

  const identifier = `admin-2fa:${payload.adminId}`;
  const lock = await prisma.adminAuthLock.findUnique({ where: { identifier } });

  if (lock?.forever) {
    return NextResponse.json(
      { error: "Account is disabled. Contact the site owner." },
      { status: 403 }
    );
  }

  if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
    const remainingMs = lock.lockedUntil.getTime() - Date.now();
    return NextResponse.json(
      {
        error: `Too many failed attempts. Please try again in ${formatLockDuration(remainingMs)}.`,
        lockedUntil: lock.lockedUntil,
        retryAfter: formatLockDuration(remainingMs),
      },
      { status: 429 }
    );
  }

  const admin = await prisma.admin.findUnique({ where: { id: payload.adminId } });

  if (!admin || !admin.active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!admin.totpSecret) {
    return NextResponse.json(
      {
        error:
          "TOTP not configured. Please complete 2FA setup before logging in.",
        needsSetup: true,
      },
      { status: 403 }
    );
  }

  const usedToken = await prisma.usedTotpToken.findUnique({
    where: { adminId_token: { adminId: payload.adminId, token: inputCode } },
  });

  if (usedToken) {
    return NextResponse.json(
      { error: "Code already used. Please wait for a new code." },
      { status: 401 }
    );
  }

  const isValid = authenticator.verify({ token: inputCode, secret: admin.totpSecret });

  if (!isValid) {
    const nextFail = (lock?.failCount ?? 0) + 1;
    const durationMs = getLockDurationMs(nextFail);
    const lockedUntil = new Date(Date.now() + durationMs);

    logSecurityEvent({
      event: "admin_2fa_fail",
      adminId: payload.adminId,
      ip,
      failCount: nextFail,
      lockDuration: formatLockDuration(durationMs),
    });

    await prisma.adminAuthLock.upsert({
      where: { identifier },
      update: { failCount: nextFail, lockedUntil, forever: false },
      create: { identifier, failCount: nextFail, lockedUntil, forever: false },
    });

    await writeAuditForAdmin(admin, req, {
      action: "admin_web_2fa_failed",
      targetType: "Admin",
      targetId: admin.id,
      details: { failCount: nextFail },
    });

    const remainingMs = lockedUntil.getTime() - Date.now();
    return NextResponse.json(
      {
        error: `Invalid 2FA code. Please try again in ${formatLockDuration(remainingMs)}.`,
        lockedUntil,
        retryAfter: formatLockDuration(remainingMs),
      },
      { status: 429 }
    );
  }

  await prisma.adminAuthLock.deleteMany({ where: { identifier } });
  await prisma.admin.update({
    where: { id: payload.adminId },
    data: { lastLoginAt: new Date() },
  });

  await recordLoginInfo(req, payload.email, payload.adminId, "web");
  await storeUsedTotpToken(payload.adminId, inputCode);

  logSecurityEvent({
    event: "admin_2fa_success",
    adminId: payload.adminId,
    ip,
  });

  await writeAuditForAdmin(admin, req, {
    action: "admin_web_2fa_success",
    targetType: "Admin",
    targetId: admin.id,
  });

  const adminToken = signAdminToken(payload.adminId);
  const isProduction = process.env.NODE_ENV === "production";

  const res = NextResponse.json({
    ok: true,
    email: payload.email,
    message: "2FA confirmed",
  });

  res.cookies.set(ADMIN_COOKIE_NAME, adminToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  res.cookies.delete(PENDING_2FA_COOKIE);

  return res;
}

async function storeUsedTotpToken(adminId: string, token: string) {
  const tokenExpiresAt = new Date(Date.now() + 90 * 1000);

  await prisma.usedTotpToken.create({
    data: { adminId, token, expiresAt: tokenExpiresAt },
  });

  prisma.usedTotpToken
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});
}

async function recordLoginInfo(
  req: NextRequest,
  adminEmail: string,
  adminId: string,
  source: "web" | "mobile"
) {
  const info = getRequestInfo(req);
  const provider = detectProvider(null);

  await prisma.adminLoginLog.create({
    data: {
      adminEmail,
      ip: info.ip,
      country: info.country,
      isp: null,
      provider,
      device: info.device,
      os: info.os,
      browser: info.browser,
      userAgent: info.userAgent,
    },
  });

  await notifyTelegram(
    [
      source === "mobile"
        ? "🚨 <b>Admin mobile login successful</b>"
        : "🚨 <b>Admin website login successful</b>",
      "",
      `<b>Admin:</b> ${escapeHtml(adminEmail)}`,
      `<b>Admin ID:</b> ${escapeHtml(adminId)}`,
      `<b>IP:</b> ${escapeHtml(info.ip)}`,
      `<b>Country:</b> ${escapeHtml(info.country || "Unknown")}`,
      `<b>Provider:</b> ${escapeHtml(provider)}`,
      `<b>Device:</b> ${escapeHtml(info.device)}`,
      `<b>OS:</b> ${escapeHtml(info.os)}`,
      `<b>Browser:</b> ${escapeHtml(info.browser)}`,
      `<b>Time:</b> ${escapeHtml(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" })
      )}`,
    ].join("\n")
  );
}
