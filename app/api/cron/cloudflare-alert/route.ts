import { NextRequest, NextResponse } from "next/server";
import { getCambodiaDayRange } from "@/lib/dailyStats";
import { checkCloudflareProtectionAlerts } from "@/lib/cloudflareAlert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-cron-secret") || "";

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}` && headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const test = req.nextUrl.searchParams.get("test") === "1";
  const range = getCambodiaDayRange();
  const result = await checkCloudflareProtectionAlerts(range, { force, test });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
