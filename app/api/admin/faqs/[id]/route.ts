import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";

const schema = z.object({
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  category: z.string().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const GET = withAdminAuth(
  async (_req, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const faq = await prisma.faq.findUnique({ where: { id } });
    if (!faq) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(faq);
  },
  { permission: "faqs.read" }
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
    const faq = await prisma.faq.update({ where: { id }, data: parsed.data });
    await writeAuditForAdmin(admin, req, {
      action: "faq.update",
      targetType: "faq",
      targetId: id,
      details: parsed.data,
    });
    revalidateAdminChange("faqs");
    return NextResponse.json(faq);
  },
  { permission: "faqs.write" }
);

export const DELETE = withAdminAuth(
  async (req, { params }: { params: Promise<{ id: string }> }, admin) => {
    const { id } = await params;
    await prisma.faq.delete({ where: { id } });
    await writeAuditForAdmin(admin, req, { action: "faq.delete", targetType: "faq", targetId: id });
    revalidateAdminChange("faqs");
    return NextResponse.json({ ok: true });
  },
  { permission: "faqs.write" }
);
