import { prisma } from "@/lib/prisma";
import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional().nullable(),
  imageUrl: z.string().min(1),
  linkUrl: z.string().optional().nullable(),
  ctaLabel: z.string().optional().nullable(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const GET = withAdminAuth(
  async () => {
    const banners = await prisma.heroBanner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(banners);
  },
  { permission: "banners.read" }
);

export const POST = withAdminAuth(
  async (req, _ctx, admin) => {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const banner = await prisma.heroBanner.create({ data: parsed.data });
    await writeAuditForAdmin(admin, req, {
      action: "banner.create",
      targetType: "banner",
      targetId: banner.id,
      details: { title: banner.title },
    });
    revalidateAdminChange("banners");
    return NextResponse.json(banner, { status: 201 });
  },
  { permission: "banners.write" }
);
