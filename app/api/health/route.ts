import { NextRequest } from "next/server";
import { publicRateLimit, rejectSuspiciousQuery, safeJson } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public, unauthenticated health probe used by the Flutter app at startup.
// Returns no sensitive data.
export async function GET(req: NextRequest) {
  const suspicious = rejectSuspiciousQuery(req);
  if (suspicious) return suspicious;

  const limited = publicRateLimit(req, "api-health", {
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  return safeJson(
    {
      ok: true,
      time: new Date().toISOString(),
      service: "JASMINTOPUP",
    },
    undefined,
    "no-store"
  );
}
