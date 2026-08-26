import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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

  const limited = publicRateLimit(req, "api-banners-public", {
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const banners = await prisma.heroBanner.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      subtitle: true,
      imageUrl: true,
      linkUrl: true,
      ctaLabel: true,
      active: true,
      sortOrder: true,
      updatedAt: true,
    },
  });

  return safeJson(
    banners.map((banner) => ({
      ...banner,
      enabled: banner.active,
      updatedAt: banner.updatedAt.toISOString(),
    })),
    undefined,
    API_NO_STORE
  );
}
