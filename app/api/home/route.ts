import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { publicRateLimit } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  turnstileToken: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const limited = publicRateLimit(req, "api-home-turnstile", {
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Missing Turnstile token" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const ok = await verifyTurnstileToken({
    req,
    token: parsed.data.turnstileToken,
    kind: "public",
    expectedAction: "home_page",
  });

  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Security verification failed" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const res = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );

  // Optional: mark homepage visitor as verified for short time
  res.cookies.set("turnstile_home_verified", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return res;
}