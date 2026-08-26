import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";

export const GET = withAdminAuth(
  async (req) => {
    const unreadOnly = req.nextUrl.searchParams.get("unreadOnly") === "true";
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("perPage") || "25", 10)));
    const where = unreadOnly ? { readAt: null } : {};

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { readAt: null } }),
    ]);

    return NextResponse.json({
      notifications,
      total,
      unreadCount,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    });
  },
  { permission: "notifications.read" }
);

export const PATCH = withAdminAuth(
  async (req) => {
    const body = await req.json().catch(() => ({}));
    if (body.action !== "mark_all_read") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const result = await prisma.notification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true, updated: result.count });
  },
  { permission: "notifications.write" }
);
