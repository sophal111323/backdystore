// app/api/security/track/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectProvider, parseUserAgent } from "@/lib/requestInfo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");

  if (!secret || secret !== process.env.INTERNAL_SECURITY_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  const ip = String(body?.ip || "unknown");
  const path = String(body?.path || "/");
  const method = String(body?.method || "GET");
  const country = body?.country ? String(body.country) : null;
  const userAgent = body?.userAgent ? String(body.userAgent) : null;
  const parsedUa = parseUserAgent(userAgent || "");
  const os = body?.os ? String(body.os) : parsedUa.os;
  const browser = body?.browser ? String(body.browser) : parsedUa.browser;
  const device = body?.device ? String(body.device) : parsedUa.device;
  const isp = body?.isp ? String(body.isp) : null;
  const statusCode = body?.statusCode ? Number(body.statusCode) : null;
  const referer = body?.referer ? String(body.referer) : null;

  const blocked = await prisma.blockedIdentity.findUnique({
    where: {
      type_value: {
        type: "ip",
        value: ip,
      },
    },
  });

  await prisma.requestLog.create({
    data: {
      ip,
      path,
      method,
      country,
      isp,
      provider: detectProvider(isp),
      device,
      os,
      browser,
      userAgent,
      referer,
      statusCode,
      blocked: Boolean(blocked),
    },
  });

  return NextResponse.json({ ok: true });
}