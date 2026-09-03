import { NextRequest, NextResponse } from "next/server";
import { API_NO_STORE, safeJson } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * PUBLIC read-only game detail endpoint:
 * - If opened directly in a browser URL bar, immediately redirect to the customer game page (/games/[slug]).
 * - For direct API probes or scanners, return 404 Not Found so internal data is never exposed.
 * The customer frontend never breaks because Next.js loads game data server-side via lib/publicData.ts.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const normalized = (slug || "").trim().toLowerCase();

  const accept = req.headers.get("accept") || "";
  const fetchDest = req.headers.get("sec-fetch-dest");

  // If opened directly from the browser, redirect to the real game page
  if (fetchDest === "document" || accept.includes("text/html")) {
    return NextResponse.redirect(new URL(`/games/${normalized}`, req.url));
  }

  // Hide the endpoint from public API scanners with 404 Not Found
  return safeJson(
    { error: "Not found" },
    { status: 404 },
    API_NO_STORE
  );
}
