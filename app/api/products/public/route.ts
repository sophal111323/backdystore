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

function isSafeId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

export async function GET(req: NextRequest) {
  const suspicious = rejectSuspiciousQuery(req);
  if (suspicious) return suspicious;

  const limited = publicRateLimit(req, "api-products-public", {
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const gameId = req.nextUrl.searchParams.get("gameId");
  const gameSlug = req.nextUrl.searchParams.get("gameSlug");

  if (gameId && !isSafeId(gameId)) {
    return safeJson({ error: "Invalid gameId" }, { status: 400 }, API_NO_STORE);
  }

  if (gameSlug && !isSafeId(gameSlug)) {
    return safeJson({ error: "Invalid gameSlug" }, { status: 400 }, API_NO_STORE);
  }

  const products = await prisma.product.findMany({
    where: {
      active: true,
      game: {
        active: true,
        ...(gameSlug ? { slug: gameSlug } : {}),
      },
      ...(gameId ? { gameId } : {}),
    },
    orderBy: [{ game: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      gameId: true,
      name: true,
      amount: true,
      bonus: true,
      priceUsd: true,
      priceKhr: true,
      badge: true,
      imageUrl: true,
      active: true,
      sortOrder: true,
      game: {
        select: {
          slug: true,
          name: true,
          currencyName: true,
          imageUrl: true,
        },
      },
    },
  });

  return safeJson(
    products.map((product) => ({
      id: product.id,
      gameId: product.gameId,
      gameSlug: product.game.slug,
      gameName: product.game.name,
      packageName: product.name,
      name: product.name,
      amount: product.amount,
      bonus: product.bonus,
      price: product.priceUsd,
      priceUsd: product.priceUsd,
      priceKhr: product.priceKhr,
      currency: "USD",
      gameCurrencyName: product.game.currencyName,
      imageUrl: product.imageUrl ?? product.game.imageUrl,
      badge: product.badge,
      enabled: product.active,
      stockStatus: product.active ? "AVAILABLE" : "UNAVAILABLE",
      sortOrder: product.sortOrder,
    })),
    undefined,
    API_NO_STORE
  );
}
