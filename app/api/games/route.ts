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

/**
 * PUBLIC read-only games list for the customer mobile app / website.
 * Returns a bare JSON array (backward-compatible with existing clients).
 * Only customer-safe display fields are selected via an explicit allowlist.
 * Full admin data stays under /api/admin/games (admin auth required).
 */
export async function GET(req: NextRequest) {
  const suspicious = rejectSuspiciousQuery(req);
  if (suspicious) return suspicious;

  const limited = publicRateLimit(req, "api-games", {
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const games = await prisma.game.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        publisher: true,
        description: true,
        imageUrl: true,
        bannerUrl: true,
        currencyName: true,
        uidLabel: true,
        uidExample: true,
        requiresServer: true,
        servers: true,
        featured: true,
        sortOrder: true,
      },
    });

    return safeJson(games, undefined, API_NO_STORE);
  } catch (error) {
    console.error("[GAMES_API_ERROR]", error);
    return safeJson(
      { error: "Internal server error" },
      { status: 500 },
      API_NO_STORE
    );
  }
}
