import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdminFromRequest } from "@/lib/auth";
import { safeAdminProfile } from "@/lib/adminMobileAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const admin = await getCurrentAdminFromRequest(req);

  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { admin: safeAdminProfile(admin) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
