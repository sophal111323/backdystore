import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  API_NO_STORE,
  publicRateLimit,
  rejectSuspiciousQuery,
  safeJson,
} from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const suspicious = rejectSuspiciousQuery(req);
  if (suspicious) return suspicious;

  const limited = publicRateLimit(req, "api-banners", {
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const banners = await prisma.heroBanner.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    // Explicit public allowlist — prevents any future sensitive column from leaking.
    select: {
      id: true,
      title: true,
      subtitle: true,
      imageUrl: true,
      linkUrl: true,
      ctaLabel: true,
      active: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return safeJson(banners, undefined, API_NO_STORE);
}
