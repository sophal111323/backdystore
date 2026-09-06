import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getIp";
import { applyRateLimit } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/secureLogger";
import { getLockDurationMs, formatLockDuration } from "@/lib/lockPolicy";
import { createAdminLoginChallenge } from "@/lib/adminMobileAuth";
import { writeAuditForAdmin } from "@/lib/audit";
import { adminApiErrorResponse } from "@/lib/adminApiError";
import { isAccessKeyConfigured, verifyAccessKey } from "@/lib/accessKey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  accessKey: z.string().min(1).max(4096),
});

const DUMMY_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8qqYv1.F9s7EuZWmhDgL4P4YJb3R1W";

/**
 * Flutter (native) admin login. The browser Turnstile challenge used by the
 * web login (POST /api/admin/auth) cannot be rendered inside the native app,
 * so bot defense here relies on compensating controls: strict per-IP rate
 * limiting, the shared `admin-login:<email>` lockout (same identifier as the
 * web login), constant-time bcrypt comparison against a dummy hash for
 * unknown emails, the shared admin access key, and mandatory TOTP 2FA before
 * any session is issued. Every attempt is audit-logged. Do not remove or
 * weaken these controls.
 *
 * The access key is required in the same request as the password because a
 * native client has no cookie chain to stage it across calls. Clients that do
 * not send `accessKey` are rejected — the web flow's three separate steps and
 * this flow's single step enforce the same three factors.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    const rl = await applyRateLimit(
      `admin-mobile-login:${ip}`,
      10,
      15 * 60 * 1000,
      ip
    );
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return invalidLoginResponse();
    }

    const email = parsed.data.email.toLowerCase().trim();
    const identifier = `admin-login:${email}`;

    const lock = await prisma.adminAuthLock.findUnique({
      where: { identifier },
    });

    if (lock?.forever) {
      return invalidLoginResponse(403);
    }

    if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
      const remainingMs = lock.lockedUntil.getTime() - Date.now();
      return NextResponse.json(
        {
          error: "Invalid login credentials.",
          lockedUntil: lock.lockedUntil,
          retryAfter: formatLockDuration(remainingMs),
        },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    const candidateHash = admin?.passwordHash ?? DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(parsed.data.password, candidateHash);

    if (!admin || !admin.active || !passwordMatch) {
      await handleLoginFail(identifier, lock?.failCount ?? 0, ip, req);
      return invalidLoginResponse(401);
    }

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

    // Checked after the password so a wrong key reveals nothing about which
    // emails exist. Shares the `admin-access-key:<adminId>` lockout with the
    // web step, so failures on either surface count together.
    const keyIdentifier = `admin-access-key:${admin.id}`;
    const keyLock = await prisma.adminAuthLock.findUnique({
      where: { identifier: keyIdentifier },
    });

    if (keyLock?.forever) {
      return invalidLoginResponse(403);
    }

    if (keyLock?.lockedUntil && keyLock.lockedUntil > new Date()) {
      const remainingMs = keyLock.lockedUntil.getTime() - Date.now();
      return NextResponse.json(
        {
          error: `Too many failed attempts. Please try again in ${formatLockDuration(
            remainingMs
          )}.`,
          lockedUntil: keyLock.lockedUntil,
          retryAfter: formatLockDuration(remainingMs),
        },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!(await verifyAccessKey(parsed.data.accessKey))) {
      await handleAccessKeyFail(
        keyIdentifier,
        keyLock?.failCount ?? 0,
        ip,
        req,
        admin
      );

      return invalidLoginResponse(401);
    }

    await prisma.adminAuthLock.deleteMany({ where: { identifier: keyIdentifier } });

    if (!admin.totpSecret) {
      await writeAuditForAdmin(admin, req, {
        action: "admin_mobile_login_blocked_2fa_not_configured",
        targetType: "Admin",
        targetId: admin.id,
      });

      return NextResponse.json(
        {
          error:
            "Google Authenticator 2FA is not configured for this admin. Please set up 2FA from the website admin first.",
          needsSetup: true,
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    await prisma.adminAuthLock.deleteMany({ where: { identifier } });

    const challenge = await createAdminLoginChallenge(admin.id, req);

    logSecurityEvent({
      event: "admin_mobile_password_success_pending_2fa",
      ip,
      adminId: admin.id,
      detail: admin.email,
    });

    await writeAuditForAdmin(admin, req, {
      action: "admin_mobile_login_password_success",
      targetType: "Admin",
      targetId: admin.id,
      details: { requires2FA: true },
    });

    return NextResponse.json(
      {
        requires2FA: true,
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Admin mobile login error:", error);
    return adminApiErrorResponse(error);
  }
}

function invalidLoginResponse(status = 400) {
  return NextResponse.json(
    { error: "Invalid login credentials." },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function handleLoginFail(
  identifier: string,
  currentFailCount: number,
  ip: string,
  req: NextRequest
) {
  const nextFail = currentFailCount + 1;
  const durationMs = getLockDurationMs(nextFail);
  const lockedUntil = new Date(Date.now() + durationMs);

  logSecurityEvent({
    event: "admin_mobile_login_fail",
    ip,
    detail: identifier,
    failCount: nextFail,
    lockDuration: formatLockDuration(durationMs),
  });

  await prisma.adminAuthLock.upsert({
    where: { identifier },
    update: { failCount: nextFail, lockedUntil, forever: false },
    create: { identifier, failCount: nextFail, lockedUntil, forever: false },
  });

  await writeAuditForAdmin(null, req, {
    action: "admin_mobile_login_failed",
    targetType: "AdminAuth",
    details: { identifier, failCount: nextFail },
  });
}

/** The submitted key is not a parameter here, so it cannot reach a log or audit row. */
async function handleAccessKeyFail(
  identifier: string,
  currentFailCount: number,
  ip: string,
  req: NextRequest,
  admin: { id: string; email: string }
) {
  const nextFail = currentFailCount + 1;
  const durationMs = getLockDurationMs(nextFail);
  const lockedUntil = new Date(Date.now() + durationMs);

  logSecurityEvent({
    event: "admin_mobile_access_key_fail",
    ip,
    adminId: admin.id,
    failCount: nextFail,
    lockDuration: formatLockDuration(durationMs),
  });

  await prisma.adminAuthLock.upsert({
    where: { identifier },
    update: { failCount: nextFail, lockedUntil, forever: false },
    create: { identifier, failCount: nextFail, lockedUntil, forever: false },
  });

  await writeAuditForAdmin(admin, req, {
    action: "admin_mobile_access_key_failed",
    targetType: "Admin",
    targetId: admin.id,
    details: { failCount: nextFail },
  });
}
