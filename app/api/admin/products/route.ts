import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";

export const dynamic = "force-dynamic";

const productSchema = z.object({
  gameId: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().int().min(0),
  bonus: z.number().int().min(0).default(0),
  priceUsd: z.number().positive(),
  priceKhr: z.number().positive().optional().nullable(),
  badge: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  supplierCode: z.string().optional().nullable(),
});

export const GET = withAdminAuth(
  async (req) => {
    const gameId = req.nextUrl.searchParams.get("gameId") || undefined;
    const activeParam = req.nextUrl.searchParams.get("active");
    const active = activeParam === null ? undefined : activeParam === "true";

    const products = await prisma.product.findMany({
      where: {
        ...(gameId ? { gameId } : {}),
        ...(active !== undefined ? { active } : {}),
      },
      include: {
        game: { select: { id: true, name: true, slug: true, sortOrder: true } },
        _count: { select: { orders: true } },
      },
      orderBy: [{ game: { sortOrder: "asc" } }, { sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(products);
  },
  { permission: "products.read" }
);

export const POST = withAdminAuth(
  async (req, _ctx, admin) => {
    const body = await req.json().catch(() => ({}));
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const game = await prisma.game.findUnique({ where: { id: parsed.data.gameId } });
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

    const product = await prisma.product.create({
      data: parsed.data,
      include: { game: { select: { id: true, name: true, slug: true } } },
    });

    await writeAuditForAdmin(admin, req, {
      action: "product.create",
      targetType: "product",
      targetId: product.id,
      details: { name: product.name, gameId: product.gameId, priceUsd: product.priceUsd },
    });
    revalidateAdminChange("products", { gameSlug: game.slug });

    return NextResponse.json(product, { status: 201 });
  },
  { permission: "products.write" }
);
