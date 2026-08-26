import { NextRequest, NextResponse } from "next/server";
import { getCambodiaDayRange } from "@/lib/dailyStats";
import { getCloudflareSecurityStats } from "@/lib/cloudflareStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const range = date ? getCambodiaDayRange(new Date(`${date}T12:00:00+07:00`)) : getCambodiaDayRange();
  const stats = await getCloudflareSecurityStats(range);

  return NextResponse.json({ ok: stats.enabled, range: stats.rangeLabel, stats });
}
