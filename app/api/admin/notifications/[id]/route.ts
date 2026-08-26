import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";

const schema = z.object({
  read: z.boolean(),
});

export const PATCH = withAdminAuth(
  async (req, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { readAt: parsed.data.read ? new Date() : null },
    });

    return NextResponse.json(notification);
  },
  { permission: "notifications.write" }
);
