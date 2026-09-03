import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  API_NO_STORE,
  publicRateLimit,
  rejectSuspiciousQuery,
  safeJson,
} from "@/lib/apiSecurity";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Hide /api/games from public direct access:
 * - If opened in a browser URL bar, immediately redirect to the homepage (/).
 * - For direct API probes or scanners, return 404 Not Found so game list is never exposed.
 * The website UI does NOT break because Next.js loads games server-side directly via lib/publicData.ts.
 */
export async function GET(req: NextRequest) {
  const accept = req.headers.get("accept") || "";
  const fetchDest = req.headers.get("sec-fetch-dest");

  // If a user types localhost:3000/api/games in Chrome, redirect to homepage immediately!
  if (fetchDest === "document" || accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Hide the endpoint from public API scanners with 404 Not Found
  return safeJson(
    { error: "Not found" },
    { status: 404 },
    API_NO_STORE
  );
}
