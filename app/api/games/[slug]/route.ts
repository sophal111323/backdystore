import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { API_NO_STORE, publicRateLimit, safeJson } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * PUBLIC read-only game detail (with active packages) for the customer app.
 * Validates the slug, returns 404 for missing/inactive games, and exposes
 * only safe display fields. Product `supplierCode` is never selected.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const normalized = slug.trim().toLowerCase();

  const limited = publicRateLimit(req, `api-game-detail:${normalized}`, {
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (!/^[a-z0-9-]{1,80}$/.test(normalized)) {
    return safeJson({ error: "Invalid request" }, { status: 400 }, API_NO_STORE);
  }

  try {
    const game = await prisma.game.findFirst({
      where: { slug: normalized, active: true },
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
        products: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            amount: true,
            bonus: true,
            priceUsd: true,
            priceKhr: true,
            badge: true,
            imageUrl: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!game) {
      return safeJson({ error: "Not found" }, { status: 404 }, API_NO_STORE);
    }

    return safeJson(game, undefined, API_NO_STORE);
  } catch (error) {
    console.error("[GAMES_API_ERROR]", error);
    return safeJson(
      { error: "Internal server error" },
      { status: 500 },
      API_NO_STORE
    );
  }
}
