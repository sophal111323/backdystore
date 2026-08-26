import { prisma } from "@/lib/prisma";

export type AdminNotificationInput = {
  type: string;
  title: string;
  message: string;
  targetType?: string | null;
  targetId?: string | null;
};

export async function createAdminNotification(input: AdminNotificationInput) {
  try {
    return await prisma.notification.create({
      data: {
        type: input.type,
        title: input.title,
        message: input.message,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
      },
    });
  } catch (error) {
    // Notification failures should never block order/product/settings updates.
    console.warn("[notification] create failed:", error);
    return null;
  }
}
