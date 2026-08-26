import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, getCurrentAdminFromRequest } from "@/lib/auth";
import { revokeAdminBearerSession } from "@/lib/adminMobileAuth";
import { writeAuditForAdmin } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PENDING_2FA_COOKIE = "admin_2fa_pending";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdminFromRequest(req).catch(() => null);
  const revokedBearer = await revokeAdminBearerSession(req).catch(() => false);

  await writeAuditForAdmin(admin, req, {
    action: "admin_logout",
    targetType: "AdminSession",
    targetId: admin?.id,
    details: { revokedBearer },
  });

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

  // Also clear web cookies so this endpoint can safely logout web or mobile callers.
  res.cookies.set(ADMIN_COOKIE_NAME, "", cookieOpts);
  res.cookies.set(PENDING_2FA_COOKIE, "", cookieOpts);

  return res;
}
