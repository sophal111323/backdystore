import { NextRequest } from "next/server";
import { publicRateLimit, rejectSuspiciousQuery, safeJson } from "@/lib/apiSecurity";
import { getPublicDataVersion, type PublicVersionScope } from "@/lib/publicVersion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_SCOPES = new Set<PublicVersionScope>([
  "home",
  "game",
  "games",
  "products",
  "banners",
  "faq",
  "faqs",
  "settings",
  "order",
]);

export async function GET(req: NextRequest) {
  const suspicious = rejectSuspiciousQuery(req);
  if (suspicious) return suspicious;

  const limited = publicRateLimit(req, "api-public-version", {
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const rawScope = req.nextUrl.searchParams.get("scope") || "home";
  const scope = rawScope as PublicVersionScope;

  if (!ALLOWED_SCOPES.has(scope)) {
    return safeJson({ error: "Invalid scope" }, { status: 400 });
  }

  const version = await getPublicDataVersion({
    scope,
    slug: req.nextUrl.searchParams.get("slug"),
    orderNumber: req.nextUrl.searchParams.get("orderNumber"),
  });

  return safeJson(
    {
      ok: true,
      scope,
      version,
    },
    undefined,
    "no-store"
  );
}
