// This route is intentionally a stub.
// This app has no user account system — orders are placed as guests.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ authenticated: false }, { status: 200 });
}