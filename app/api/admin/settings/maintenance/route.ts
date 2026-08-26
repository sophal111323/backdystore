import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().min(1).optional(),
});

export const PATCH = withAdminAuth(
  async (req, _ctx, admin) => {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Failed to update maintenance mode", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {
        maintenanceMode: data.maintenanceMode,
        maintenanceMessage:
          data.maintenanceMessage ??
          "Server កំពុងថែទាំបណ្តោះអាសន្ន។ សូមរង់ចាំប្រហែល 30 នាទី។",
      },
      create: {
        id: 1,
        siteName: "JASMINTOPUP",
        exchangeRate: 4100,
        supportTelegram: "@jasmintopup",
        supportEmail: "support@jasmintopup.com",
        maintenanceMode: data.maintenanceMode,
        maintenanceMessage:
          data.maintenanceMessage ??
          "Server កំពុងថែទាំបណ្តោះអាសន្ន។ សូមរង់ចាំប្រហែល 30 នាទី។",
      },
      select: {
        maintenanceMode: true,
        maintenanceMessage: true,
      },
    });

    await writeAuditForAdmin(admin, req, {
      action: "settings.maintenance.update",
      targetType: "settings",
      targetId: "1",
      details: data,
    });
    revalidateAdminChange("settings");

    return NextResponse.json({ success: true, settings });
  },
  { permission: "settings.write" }
);
