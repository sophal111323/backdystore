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
import {
  ACCESS_KEY_PENDING_COOKIE,
  ACCESS_KEY_PENDING_TYPE,
} from "@/lib/accessKey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: z.string().min(1),
});

const PENDING_2FA_COOKIE = "admin_2fa_pending";
const DEFAULT_2FA_TTL_SECONDS = 5 * 60;

// Signed httpOnly cookie that binds login-lock visibility to the browser that
// actually experienced a failed login attempt. GET /api/admin/auth reveals lock
// state only for the identifier stored in this cookie — never from the query
// string — so arbitrary emails cannot be probed by third parties.
const LOCK_HINT_COOKIE = "admin_lock_ref";
const LOCK_HINT_TTL_SECONDS = 60 * 60; // ~1 hour

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

function signLockHintToken(identifier: string) {
  return jwt.sign(
    { type: "admin-lock-hint", identifier },
    getAdminJwtSecret(),
    { expiresIn: LOCK_HINT_TTL_SECONDS }
  );
}

function verifyLockHintToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, getAdminJwtSecret()) as {
      type?: unknown;
      identifier?: unknown;
    };

    if (
      payload &&
      payload.type === "admin-lock-hint" &&
      typeof payload.identifier === "string" &&
      payload.identifier.length > 0
    ) {
      return payload.identifier;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Only the browser that just failed a login attempt may later read that
 * lock's status via GET. Called exclusively from lock-active branches of POST.
 */
function setLockHintCookie(
  res: NextResponse,
  identifier: string
) {
  res.cookies.set(LOCK_HINT_COOKIE, signLockHintToken(identifier), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: LOCK_HINT_TTL_SECONDS,
  });
}

function clearLockHintCookie(res: NextResponse) {
  res.cookies.set(LOCK_HINT_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

// ── GET: check login lock status (bound to the admin_lock_ref cookie) ────────
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    // Rate limit: 20 requests per IP per 15 minutes (defense in depth)
    const rl = await applyRateLimit(
      `admin-lock-status:${ip}`,
      20,
      15 * 60 * 1000,
      ip
    );

    if (rl) return rl;

    // Lock status is revealed only for the identifier bound to this browser
    // by the signed httpOnly admin_lock_ref cookie — never from the query
    // string. Missing/invalid cookie → { locked: false }, no DB call.
    const hintToken = req.cookies.get(LOCK_HINT_COOKIE)?.value;
    const identifier = hintToken ? verifyLockHintToken(hintToken) : null;

    if (!identifier) {
      return NextResponse.json(
        { locked: false },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

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
  const isProduction = process.env.NODE_ENV === "production";

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
      token: parsed.data.turnstileToken,
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
      const res = NextResponse.json(
        { error: "Account is disabled. Contact the site owner." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );

      setLockHintCookie(res, identifier);
      return res;
    }

    if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
      const remainingMs = lock.lockedUntil.getTime() - Date.now();

      const res = NextResponse.json(
        {
          error: `Too many failed attempts. Please try again in ${formatLockDuration(
            remainingMs
          )}.`,
          lockedUntil: lock.lockedUntil,
          retryAfter: formatLockDuration(remainingMs),
        },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );

      setLockHintCookie(res, identifier);
      return res;
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
        const res = NextResponse.json(
          {
            error: `Password មិនត្រឹមត្រូវ។ គណនីត្រូវ lock រយៈពេល ${formatLockDuration(remainingMs)}។`,
            lockedUntil: result.lockedUntil,
            retryAfter: formatLockDuration(remainingMs),
            attemptsRemaining: 0,
          },
          { status: 429, headers: { "Cache-Control": "no-store" } }
        );

        setLockHintCookie(res, identifier);
        return res;
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
      event: "admin_password_success_pending_access_key",
      ip,
      detail: email,
    });

    // Step 2 of 3. The access key is demanded whether or not TOTP is enrolled,
    // and POST /api/admin/auth/access-key is the only issuer of the pending-2FA
    // cookie that step 3 accepts — so neither later step can be reached from
    // here.
    const ttlSeconds = get2FATtlSeconds();
    const pendingKeyToken = jwt.sign(
      {
        type: ACCESS_KEY_PENDING_TYPE,
        adminId: String(admin.id),
        email: admin.email,
      },
      getAdminJwtSecret(),
      { expiresIn: ttlSeconds }
    );

    const res = NextResponse.json(
      {
        ok: true,
        requiresAccessKey: true,
        email: admin.email,
        message: "Password ត្រឹមត្រូវ។ សូមបញ្ចូល Access Key។",
      },
      { headers: { "Cache-Control": "no-store" } }
    );

    res.cookies.set(ACCESS_KEY_PENDING_COOKIE, pendingKeyToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: ttlSeconds,
    });

    // A pending-2FA cookie left over from an earlier attempt would otherwise
    // let a fresh password step jump straight to step 3.
    res.cookies.set(PENDING_2FA_COOKIE, "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    // ✅ Password step succeeded — drop any stale lock hint.
    clearLockHintCookie(res);

    return res;
  } catch (error) {
    console.error("Admin login error:", error);

    return adminApiErrorResponse(error);
  }
}

// ── DELETE: logout — clear every login-stage cookie ──────────────────────────
export async function DELETE() {
  const res = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );

  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };

  res.cookies.set(ADMIN_COOKIE_NAME, "", cookieOpts);
  res.cookies.set(ACCESS_KEY_PENDING_COOKIE, "", cookieOpts);
  res.cookies.set(PENDING_2FA_COOKIE, "", cookieOpts);
  res.cookies.set(LOCK_HINT_COOKIE, "", cookieOpts);

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
