import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";

const updateSchema = z.object({
  code: z.string().min(2).max(30).transform((v) => v.toUpperCase().trim()).optional(),
  discountType: z.enum(["PERCENT", "FIXED"]).optional(),
  discountValue: z.number().positive().optional(),
  minOrderUsd: z.number().min(0).optional(),
  maxUses: z.number().int().min(0).optional(),
  expiresAt: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const GET = withAdminAuth(
  async (_req, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const promo = await prisma.promoCode.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!promo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(promo);
  },
  { permission: "promoCodes.read" }
);

export const PATCH = withAdminAuth(
  async (req, { params }: { params: Promise<{ id: string }> }, admin) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    try {
      const promo = await prisma.promoCode.update({
        where: { id },
        data: {
          ...(data.code !== undefined ? { code: data.code } : {}),
          ...(data.discountType !== undefined ? { discountType: data.discountType } : {}),
          ...(data.discountValue !== undefined ? { discountValue: data.discountValue } : {}),
          ...(data.minOrderUsd !== undefined ? { minOrderUsd: data.minOrderUsd } : {}),
          ...(data.maxUses !== undefined ? { maxUses: data.maxUses } : {}),
          ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
        },
      });

      await writeAuditForAdmin(admin, req, {
        action: "promo_code.update",
        targetType: "promo_code",
        targetId: id,
        details: data,
      });
      revalidateAdminChange("promoCodes");

      return NextResponse.json(promo);
    } catch (err: any) {
      if (err.code === "P2002") return NextResponse.json({ error: "Code already exists" }, { status: 409 });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  },
  { permission: "promoCodes.write" }
);

export const DELETE = withAdminAuth(
  async (req, { params }: { params: Promise<{ id: string }> }, admin) => {
    const { id } = await params;
    const promo = await prisma.promoCode.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!promo) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (promo._count.orders > 0) {
      const disabled = await prisma.promoCode.update({ where: { id }, data: { active: false } });
      await writeAuditForAdmin(admin, req, {
        action: "promo_code.disable.safe_delete",
        targetType: "promo_code",
        targetId: id,
        details: "Promo code has orders, so it was disabled instead of deleted.",
      });
      revalidateAdminChange("promoCodes");
      return NextResponse.json({ ok: true, deleted: false, disabled });
    }

    await prisma.promoCode.delete({ where: { id } });
    await writeAuditForAdmin(admin, req, { action: "promo_code.delete", targetType: "promo_code", targetId: id });
    revalidateAdminChange("promoCodes");
    return NextResponse.json({ ok: true, deleted: true });
  },
  { permission: "promoCodes.write" }
);
