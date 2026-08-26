/**
 * /api/admin/auth/2fa/setup — TOTP QR Code setup (Issue #1)
 *
 * GET  → returns TOTP provisioning URI + QR URL for scanning with an
 *         authenticator app. Only available to already-logged-in admins.
 *
 * POST → confirms the setup by verifying the first code the admin enters,
 *         then saves the secret to the database.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticator } from "otplib";
import { getCurrentAdmin } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/secureLogger";
import { getClientIp } from "@/lib/getIp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

authenticator.options = { window: 1 };

const confirmSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
  secret: z.string().min(16),
});

// ── GET: generate a new TOTP secret and return QR provisioning URI ──────────
export async function GET(req: NextRequest) {
  // Rate limit: 5 attempts per IP per 15 minutes
  const ip = getClientIp(req);
  const rl = await applyRateLimit(`2fa-setup:${ip}`, 5, 15 * 60 * 1000, ip);
  if (rl) return rl;

  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate a fresh secret (not saved yet — saved on POST confirm)
  const secret = authenticator.generateSecret(20);
  const issuer = process.env.NEXT_PUBLIC_SITE_NAME || "JASMINTOPUP";
  const otpAuthUrl = authenticator.keyuri(admin.email, issuer, secret);

  // Use Google Charts API to render QR (no sensitive server-side lib needed)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuthUrl)}`;

  return NextResponse.json({
    secret,        // shown once so admin can also manually enter it
    otpAuthUrl,    // scannable URI
    qrUrl,         // render as <img src={qrUrl} />
    alreadyConfigured: !!admin.totpSecret,
  });
}

// ── POST: confirm setup by verifying first code, then save secret ───────────
export async function POST(req: NextRequest) {
  // Rate limit: 5 attempts per IP per 15 minutes
  const ip = getClientIp(req);
  const rl = await applyRateLimit(`2fa-setup:${ip}`, 5, 15 * 60 * 1000, ip);
  if (rl) return rl;

  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { code, secret } = parsed.data;

  const isValid = authenticator.verify({ token: code, secret });
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid code. Please scan the QR again and try a fresh code." },
      { status: 400 }
    );
  }

  // Save the confirmed secret
  await prisma.admin.update({
    where: { id: admin.id },
    data: { totpSecret: secret },
  });

  logSecurityEvent({
    event: "admin_settings_changed",
    adminId: admin.id,
    detail: "totp_secret_configured",
  });

  return NextResponse.json({ ok: true, message: "TOTP 2FA configured successfully." });
}