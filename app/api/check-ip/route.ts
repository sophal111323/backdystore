import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // ✅ Admin auth check — IP info is sensitive infrastructure data
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();

    return NextResponse.json({
      outbound_ip: data.ip,
      message: "This is the outbound IP that Tola Saint sees when your server makes requests.",
      fixie_enabled: !!process.env.FIXIE_URL,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch outbound IP", detail: String(err) },
      { status: 500 }
    );
  }
}