import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";

export const GET = withAdminAuth(
  async (req) => {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "50", 10)));
    const action = searchParams.get("action") || undefined;
    const targetType = searchParams.get("targetType") || undefined;
    const adminEmail = searchParams.get("adminEmail") || undefined;

    const where: any = {};
    if (action) where.action = { contains: action, mode: "insensitive" as const };
    if (targetType) where.targetType = targetType;
    if (adminEmail) where.adminEmail = { contains: adminEmail, mode: "insensitive" as const };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    });
  },
  { permission: "auditLogs.read" }
);
