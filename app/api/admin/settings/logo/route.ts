import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";

export const dynamic = "force-dynamic";

export const GET = withAdminAuth(
  async () => {
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        siteName: "JASMIN TOPUP",
        exchangeRate: 4100,
        maintenanceMode: false,
      },
      select: {
        logoUrl: true,
        logoText: true,
        logoTagline: true,
      },
    });

    return NextResponse.json({
      logoUrl: settings.logoUrl ?? null,
      logoText: settings.logoText ?? null,
      logoTagline: settings.logoTagline ?? null,
    });
  },
  { permission: "settings.read" }
);
