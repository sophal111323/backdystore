import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";

const ADMIN_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

const imagePath = z
  .string()
  .min(1)
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/uploads/") || v.startsWith("/"), {
    message: "Must be a URL or uploaded file path",
  });

const updateSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(1).optional(),
  publisher: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  imageUrl: imagePath.optional(),
  bannerUrl: imagePath.optional().or(z.literal("")),
  currencyName: z.string().min(1).optional(),
  uidLabel: z.string().optional(),
  uidExample: z.string().optional().nullable(),
  requiresServer: z.boolean().optional(),
  servers: z.string().optional(),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
});

export const GET = withAdminAuth(
  async (_req, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const game = await prisma.game.findUnique({
        where: { id },
        include: {
          products: { orderBy: { sortOrder: "asc" } },
          _count: { select: { orders: true, products: true } },
        },
      });
      if (!game) {
        return NextResponse.json({ error: "Not found" }, { status: 404, headers: ADMIN_HEADERS });
      }
      return NextResponse.json(game, { headers: ADMIN_HEADERS });
    } catch (error) {
      console.error("[ADMIN_GAMES_API_ERROR]", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: ADMIN_HEADERS }
      );
    }
  },
  { permission: "games.read" }
);

export const PATCH = withAdminAuth(
  async (req, { params }: { params: Promise<{ id: string }> }, admin) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid", details: parsed.error.flatten() },
        { status: 400, headers: ADMIN_HEADERS }
      );
    }

    const existing = await prisma.game.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: ADMIN_HEADERS });
    }

    try {
      const game = await prisma.game.update({
        where: { id },
        data: parsed.data,
      });
      await writeAuditForAdmin(admin, req, {
        action: "game.update",
        targetType: "game",
        targetId: id,
        details: { beforeSlug: existing.slug, changes: parsed.data },
      });
      revalidateAdminChange("games", { gameSlug: existing.slug });
      if (game.slug !== existing.slug) revalidateAdminChange("games", { gameSlug: game.slug });
      return NextResponse.json(game, { headers: ADMIN_HEADERS });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "Slug already exists" },
          { status: 409, headers: ADMIN_HEADERS }
        );
      }
      console.error("[ADMIN_GAMES_API_ERROR]", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: ADMIN_HEADERS }
      );
    }
  },
  { permission: "games.write" }
);

export const DELETE = withAdminAuth(
  async (req, { params }: { params: Promise<{ id: string }> }, admin) => {
    try {
      const { id } = await params;
      const game = await prisma.game.findUnique({
        where: { id },
        include: { _count: { select: { orders: true, products: true } } },
      });
      if (!game) {
        return NextResponse.json({ error: "Not found" }, { status: 404, headers: ADMIN_HEADERS });
      }

      if (game._count.orders > 0 || game._count.products > 0) {
        const disabled = await prisma.game.update({ where: { id }, data: { active: false } });
        await writeAuditForAdmin(admin, req, {
          action: "game.disable.safe_delete",
          targetType: "game",
          targetId: id,
          details: "Game has products/orders, so it was disabled instead of deleted.",
        });
        revalidateAdminChange("games", { gameSlug: game.slug });
        return NextResponse.json({ ok: true, deleted: false, disabled }, { headers: ADMIN_HEADERS });
      }

      await prisma.game.delete({ where: { id } });
      await writeAuditForAdmin(admin, req, { action: "game.delete", targetType: "game", targetId: id });
      revalidateAdminChange("games", { gameSlug: game.slug });
      return NextResponse.json({ ok: true, deleted: true }, { headers: ADMIN_HEADERS });
    } catch (error) {
      console.error("[ADMIN_GAMES_API_ERROR]", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: ADMIN_HEADERS }
      );
    }
  },
  { permission: "games.write" }
);
