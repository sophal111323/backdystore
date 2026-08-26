import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";

const schema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  category: z.string().default("general"),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const GET = withAdminAuth(
  async () => {
    const items = await prisma.faq.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(items);
  },
  { permission: "faqs.read" }
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
    const faq = await prisma.faq.create({ data: parsed.data });
    await writeAuditForAdmin(admin, req, {
      action: "faq.create",
      targetType: "faq",
      targetId: faq.id,
      details: { question: faq.question, category: faq.category },
    });
    revalidateAdminChange("faqs");
    return NextResponse.json(faq, { status: 201 });
  },
  { permission: "faqs.write" }
);
