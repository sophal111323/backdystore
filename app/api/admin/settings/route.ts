import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";
import { logSecurityEvent } from "@/lib/secureLogger";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  siteName: z.string().min(1).optional(),
  exchangeRate: z.number().positive().optional(),
  supportTelegram: z.string().optional().nullable(),
  supportTikTok: z.string().optional().nullable(),
  supportEmail: z.string().email().optional().nullable().or(z.literal("")),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().nullable().optional(),
  announcementEnabled: z.boolean().optional(),
  announcement: z.string().nullable().optional(),
  announcementTone: z.enum(["info", "warning", "promo"]).nullable().optional(),
  appMinSupportedVersion: z.string().min(1).optional(),
  appLatestVersion: z.string().min(1).optional(),
  appForceUpdate: z.boolean().optional(),
  appUpdateUrl: z.string().optional().nullable(),
  ordersEnabled: z.boolean().optional(),
  paymentsEnabled: z.boolean().optional(),
  promosEnabled: z.boolean().optional(),
  logoUrl: z.string().nullable().optional(),
  logoText: z.string().nullable().optional(),
  logoTagline: z.string().nullable().optional(),
  telegramBotToken: z.string().nullable().optional(),
  telegramChatId: z.string().nullable().optional(),
});

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "••••";
  return "••••••••" + value.slice(-4);
}

export const GET = withAdminAuth(
  async () => {
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });

    return NextResponse.json({
      ...settings,
      telegramBotToken: maskSecret(settings.telegramBotToken),
    });
  },
  { permission: "settings.read" }
);

export const PATCH = withAdminAuth(
  async (req, _ctx, admin) => {
    const body = await req.json().catch(() => ({}));
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (typeof data.telegramBotToken === "string" && data.telegramBotToken.startsWith("••••")) {
      delete data.telegramBotToken;
    }

    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });

    await writeAuditForAdmin(admin, req, {
      action: "settings.update",
      targetType: "settings",
      targetId: "1",
      details: Object.keys(data),
    });

    logSecurityEvent({
      event: "admin_settings_changed",
      adminId: admin.id,
      detail: Object.keys(data).join(", "),
    });

    revalidateAdminChange("settings");

    return NextResponse.json({
      ...settings,
      telegramBotToken: maskSecret(settings.telegramBotToken),
    });
  },
  { permission: "settings.write" }
);
