import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getClientIp } from "@/lib/getIp";

import { prisma } from "@/lib/prisma";
import { applyRateLimit } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/secureLogger";
import { ADMIN_COOKIE_NAME } from "@/lib/auth";
import { getLockDurationMs, formatLockDuration } from "@/lib/lockPolicy";
import { adminApiErrorResponse } from "@/lib/adminApiError";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: z.string().optional(),
});

const PENDING_2FA_COOKIE = "admin_2fa_pending";
const DEFAULT_2FA_TTL_SECONDS = 5 * 60;

function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET is not set");
  return secret;
}

function get2FATtlSeconds() {
  const ttl = Number(
    process.env.ADMIN_2FA_TTL_SECONDS || DEFAULT_2FA_TTL_SECONDS
  );

  if (!Number.isFinite(ttl) || ttl <= 0) {
    return DEFAULT_2FA_TTL_SECONDS;
  }

  return Math.floor(ttl);
}

// ── GET: check login lock status ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { locked: false },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const identifier = `admin-login:${email.toLowerCase().trim()}`;

    const lock = await prisma.adminAuthLock.findUnique({
      where: { identifier },
    });

    if (!lock) {
      return NextResponse.json(
        { locked: false },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Backward-compat: respect legacy forever locks already in the DB.
    if (lock.forever) {
      return NextResponse.json(
        { locked: true, forever: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (lock.lockedUntil && lock.lockedUntil > new Date()) {
      const remainingMs = lock.lockedUntil.getTime() - Date.now();

      return NextResponse.json(
        {
          locked: true,
          forever: false,
          lockedUntil: lock.lockedUntil,
          retryAfter: formatLockDuration(remainingMs),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { locked: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Admin login lock check error:", error);
    return adminApiErrorResponse(error);
  }
}

// ── POST: password login → issues pending-2FA cookie ─────────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    // Rate limit: 10 attempts per IP per 15 minutes
    const rl = await applyRateLimit(
      `admin-login:${ip}`,
      10,
      15 * 60 * 1000,
      ip
    );

    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 🛡️ Cloudflare Turnstile Bot Protection for Admin Login
    const isBotChallengePassed = await verifyTurnstileToken({
      req,
      token: parsed.data.turnstileToken || "",
      kind: "admin",
      expectedAction: "admin_login",
    });

    if (!isBotChallengePassed) {
      return NextResponse.json(
        { error: "ការផ្ទៀងផ្ទាត់សុវត្ថិភាព Turnstile មិនជោគជ័យ។ សូមព្យាយាមម្តងទៀត។" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const identifier = `admin-login:${email}`;

    const lock = await prisma.adminAuthLock.findUnique({
      where: { identifier },
    });

    // Backward-compat: respect legacy forever locks already in DB.
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

    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    // Always run bcrypt even for unknown email to reduce timing differences.
    // This is a valid bcrypt hash for dummy comparison only.
    const DUMMY_HASH =
      "$2a$10$CwTycUXWue0Thq9StjUM0uJ8qqYv1.F9s7EuZWmhDgL4P4YJb3R1W";

    const candidateHash = admin?.passwordHash ?? DUMMY_HASH;

    const passwordMatch = await bcrypt.compare(
      parsed.data.password,
      candidateHash
    );

    if (!admin || !admin.active || !passwordMatch) {
      const result = await handleLoginFail(
        identifier,
        lock?.failCount ?? 0,
        ip
      );

      if (result.isLocked && result.lockedUntil) {
        const remainingMs = result.lockedUntil.getTime() - Date.now();
        return NextResponse.json(
          {
            error: `Password មិនត្រឹមត្រូវ។ គណនីត្រូវ lock រយៈពេល ${formatLockDuration(remainingMs)}។`,
            lockedUntil: result.lockedUntil,
            retryAfter: formatLockDuration(remainingMs),
            attemptsRemaining: 0,
          },
          { status: 429, headers: { "Cache-Control": "no-store" } }
        );
      }

      const remainingAttempts = Math.max(0, 3 - result.failCount);
      return NextResponse.json(
        {
          error: `Password មិនត្រឹមត្រូវ។ (នៅសល់ ${remainingAttempts} លើកទៀត មុនពេល lock)`,
          attemptsRemaining: remainingAttempts,
        },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ Password correct — clear lock
    await prisma.adminAuthLock.deleteMany({
      where: { identifier },
    });

    logSecurityEvent({
      event: admin.totpSecret
        ? "admin_password_success_pending_2fa"
        : "admin_login_success",
      ip,
      detail: email,
    });

    const isProduction = process.env.NODE_ENV === "production";

    // If 2FA (totpSecret) is configured, proceed to 2FA step
    if (admin.totpSecret) {
      const ttlSeconds = get2FATtlSeconds();
      const pendingToken = jwt.sign(
        {
          type: "admin-2fa-pending",
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
          message: "Password ត្រឹមត្រូវ។ សូមបញ្ចូលកូដ 2FA។",
        },
        { headers: { "Cache-Control": "no-store" } }
      );

      res.cookies.set(PENDING_2FA_COOKIE, pendingToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
        path: "/",
        maxAge: ttlSeconds,
      });

      return res;
    }

    // If 2FA is NOT configured, log in directly!
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
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    res.cookies.set(PENDING_2FA_COOKIE, "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (error) {
    console.error("Admin login error:", error);

    return adminApiErrorResponse(error);
  }
}

// ── DELETE: logout — clear both session cookies ───────────────────────────────
export async function DELETE() {
  const isProduction = process.env.NODE_ENV === "production";

  const res = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );

  const cookieOpts = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };

  res.cookies.set(ADMIN_COOKIE_NAME, "", cookieOpts);
  res.cookies.set(PENDING_2FA_COOKIE, "", cookieOpts);

  return res;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Increments the fail counter and applies a progressive temporary lock.
 * Never sets forever=true — manual disable is done via Admin.active field.
 */
async function handleLoginFail(
  identifier: string,
  currentFailCount: number,
  ip: string
) {
  const nextFail = currentFailCount + 1;
  const durationMs = getLockDurationMs(nextFail);
  const isLocked = durationMs > 0;
  const lockedUntil = isLocked ? new Date(Date.now() + durationMs) : null;

  logSecurityEvent({
    event: "admin_login_fail",
    ip,
    detail: identifier,
    failCount: nextFail,
    lockDuration: isLocked ? formatLockDuration(durationMs) : "none",
  });

  await prisma.adminAuthLock.upsert({
    where: { identifier },
    update: {
      failCount: nextFail,
      lockedUntil,
      forever: false,
    },
    create: {
      identifier,
      failCount: nextFail,
      lockedUntil,
      forever: false,
    },
  });

  return { failCount: nextFail, isLocked, lockedUntil };
}
