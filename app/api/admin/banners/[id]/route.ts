import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";

const schema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().optional().nullable(),
  imageUrl: z.string().min(1).optional(),
  linkUrl: z.string().optional().nullable(),
  ctaLabel: z.string().optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const GET = withAdminAuth(
  async (_req, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const banner = await prisma.heroBanner.findUnique({ where: { id } });
    if (!banner) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(banner);
  },
  { permission: "banners.read" }
);

export const PATCH = withAdminAuth(
  async (req, { params }: { params: Promise<{ id: string }> }, admin) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const banner = await prisma.heroBanner.update({ where: { id }, data: parsed.data });
    await writeAuditForAdmin(admin, req, {
      action: "banner.update",
      targetType: "banner",
      targetId: id,
      details: parsed.data,
    });
    revalidateAdminChange("banners");
    return NextResponse.json(banner);
  },
  { permission: "banners.write" }
);

export const DELETE = withAdminAuth(
  async (req, { params }: { params: Promise<{ id: string }> }, admin) => {
    const { id } = await params;
    await prisma.heroBanner.delete({ where: { id } });
    await writeAuditForAdmin(admin, req, { action: "banner.delete", targetType: "banner", targetId: id });
    revalidateAdminChange("banners");
    return NextResponse.json({ ok: true });
  },
  { permission: "banners.write" }
);
