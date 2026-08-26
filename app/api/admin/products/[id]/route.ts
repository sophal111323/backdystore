import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";

const updateSchema = z.object({
  gameId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  amount: z.number().int().min(0).optional(),
  bonus: z.number().int().min(0).optional(),
  priceUsd: z.number().positive().optional(),
  priceKhr: z.number().positive().nullable().optional(),
  badge: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  supplierCode: z.string().nullable().optional(),
});

export const GET = withAdminAuth(
  async (_req, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { game: true, _count: { select: { orders: true } } },
    });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(product);
  },
  { permission: "products.read" }
);

export const PATCH = withAdminAuth(
  async (req, { params }: { params: Promise<{ id: string }> }, admin) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.product.findUnique({
      where: { id },
      include: { game: { select: { slug: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (parsed.data.gameId) {
      const game = await prisma.game.findUnique({ where: { id: parsed.data.gameId } });
      if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const product = await prisma.product.update({
      where: { id },
      data: parsed.data,
      include: { game: { select: { id: true, name: true, slug: true } } },
    });

    await writeAuditForAdmin(admin, req, {
      action: "product.update",
      targetType: "product",
      targetId: id,
      details: parsed.data,
    });
    revalidateAdminChange("products", { gameSlug: existing.game.slug });
    if (product.game.slug !== existing.game.slug) revalidateAdminChange("products", { gameSlug: product.game.slug });

    return NextResponse.json(product);
  },
  { permission: "products.write" }
);

export const DELETE = withAdminAuth(
  async (req, { params }: { params: Promise<{ id: string }> }, admin) => {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { game: { select: { slug: true } }, _count: { select: { orders: true } } },
    });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (product._count.orders > 0) {
      const disabled = await prisma.product.update({ where: { id }, data: { active: false } });
      await writeAuditForAdmin(admin, req, {
        action: "product.disable.safe_delete",
        targetType: "product",
        targetId: id,
        details: "Product has orders, so it was disabled instead of deleted.",
      });
      revalidateAdminChange("products", { gameSlug: product.game.slug });
      return NextResponse.json({ ok: true, deleted: false, disabled });
    }

    await prisma.product.delete({ where: { id } });
    await writeAuditForAdmin(admin, req, { action: "product.delete", targetType: "product", targetId: id });
    revalidateAdminChange("products", { gameSlug: product.game.slug });
    return NextResponse.json({ ok: true, deleted: true });
  },
  { permission: "products.write" }
);
