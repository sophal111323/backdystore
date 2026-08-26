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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const DUMMY_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8qqYv1.F9s7EuZWmhDgL4P4YJb3R1W";

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
