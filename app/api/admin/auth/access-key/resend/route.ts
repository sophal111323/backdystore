import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getIp";
import { applyRateLimit } from "@/lib/rateLimit";
import {
  ACCESS_KEY_PENDING_COOKIE,
  ACCESS_KEY_PENDING_TYPE,
  generateAndSendTelegramAccessKey,
  getActiveHourlyAccessKey,
} from "@/lib/accessKey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET is not set");
  return secret;
}

type PendingPayload = {
  type?: string;
  adminId?: string;
  email?: string;
};

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

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    // 5 resend requests per 10 minutes per IP
    const rl = await applyRateLimit(
      `admin-access-key-resend:${ip}`,
      5,
      10 * 60 * 1000,
      ip
    );
    if (rl) return rl;

    const payload = readPendingKeyToken(req);
    if (!payload?.adminId || !payload.email) {
      return NextResponse.json(
        { error: "Login session expired. Please start again.", step: "login" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });

    if (!admin || !admin.active) {
      return NextResponse.json(
        { error: "Admin account not found or disabled." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await generateAndSendTelegramAccessKey(
      admin.id,
      admin.email,
      ip
    );

    if (!result.success && result.error) {
      return NextResponse.json(
        {
          error: result.error,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    const isDev = process.env.NODE_ENV !== "production";
    const currentKey = getActiveHourlyAccessKey();

    return NextResponse.json(
      {
        ok: true,
        ...(isDev && currentKey ? { devAccessKey: currentKey } : {}),
        message:
          "កូដ Access Key 256 តួអក្សរ ត្រូវបានផ្ញើទៅ Telegram រួចរាល់ហើយ (សុពលភាព 1 ម៉ោង)។",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Resend access key error:", err);
    return NextResponse.json(
      { error: "Failed to resend access key. Please try again later." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

