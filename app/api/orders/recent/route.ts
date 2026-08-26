import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  API_CACHE_DYNAMIC,
  publicRateLimit,
  rejectSuspiciousQuery,
  safeJson,
} from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const suspicious = rejectSuspiciousQuery(req);
  if (suspicious) return suspicious;

  const limited = publicRateLimit(req, "api-orders-recent", {
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const orders = await prisma.order.findMany({
      where: { status: "DELIVERED" },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        game: { select: { name: true } },
        product: { select: { name: true } },
      },
    });

    return safeJson(
      {
        orders: orders.map((o) => ({
          gameName: o.game.name,
          productName: o.product.name,
          playerUid: o.playerUid.slice(0, 3) + "***",
          createdAt: o.createdAt.toISOString(),
        })),
      },
      undefined,
      API_CACHE_DYNAMIC
    );
  } catch {
    return safeJson({ orders: [] }, undefined, API_CACHE_DYNAMIC);
  }
}
