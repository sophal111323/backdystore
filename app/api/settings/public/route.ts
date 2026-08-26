import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  API_NO_STORE,
  publicRateLimit,
  rejectSuspiciousQuery,
  safeJson,
} from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_MAINTENANCE_MESSAGE =
  "Server កំពុងថែទាំបណ្តោះអាសន្ន។ សូមរង់ចាំប្រហែល 30 នាទី។";

type PublicSettingsRecord = {
  siteName: string;
  exchangeRate: number;
  supportTelegram: string | null;
  supportTikTok: string | null;
  supportEmail: string | null;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  announcementEnabled: boolean;
  announcement: string | null;
  announcementTone: string | null;
  appMinSupportedVersion: string;
  appLatestVersion: string;
  appForceUpdate: boolean;
  appUpdateUrl: string | null;
  ordersEnabled: boolean;
  paymentsEnabled: boolean;
  promosEnabled: boolean;
  logoUrl: string | null;
  logoText: string | null;
  logoTagline: string | null;
  updatedAt: Date;
} | null;

function buildPublicSettings(settings: PublicSettingsRecord) {
  const announcementText = settings?.announcement ?? "";
  const announcementEnabled = Boolean(
    settings?.announcementEnabled && announcementText.trim().length > 0
  );

  return {
    siteName: settings?.siteName ?? "JASMIN TOPUP",
    exchangeRate: settings?.exchangeRate ?? 4100,
    maintenanceMode: settings?.maintenanceMode ?? false,
    maintenanceMessage:
      settings?.maintenanceMessage ?? DEFAULT_MAINTENANCE_MESSAGE,
    announcementEnabled,
    announcementText: announcementEnabled ? announcementText : "",
    announcementTone: settings?.announcementTone ?? "info",
    supportTelegram: settings?.supportTelegram ?? "@jasmintopup",
    supportTikTok: settings?.supportTikTok ?? "",
    supportEmail: settings?.supportEmail ?? null,
    logoUrl: settings?.logoUrl ?? "/jasmintopup-logo.png",
    logoText: settings?.logoText ?? "JASMINTOPUP",
    logoTagline: settings?.logoTagline ?? "Instant · Secure · 24/7",
    appConfig: {
      minSupportedVersion: settings?.appMinSupportedVersion ?? "1.0.0",
      latestVersion: settings?.appLatestVersion ?? "1.0.0",
      forceUpdate: settings?.appForceUpdate ?? false,
      updateUrl: settings?.appUpdateUrl ?? "",
    },
    featureFlags: {
      ordersEnabled: settings?.ordersEnabled ?? true,
      paymentsEnabled: settings?.paymentsEnabled ?? true,
      promosEnabled: settings?.promosEnabled ?? true,
    },
    updatedAt: settings?.updatedAt?.toISOString() ?? null,
  };
}

export async function GET(req: NextRequest) {
  const suspicious = rejectSuspiciousQuery(req);
  if (suspicious) return suspicious;

  const limited = publicRateLimit(req, "api-settings-public", {
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
      select: {
        siteName: true,
        exchangeRate: true,
        supportTelegram: true,
        supportTikTok: true,
        supportEmail: true,
        maintenanceMode: true,
        maintenanceMessage: true,
        announcementEnabled: true,
        announcement: true,
        announcementTone: true,
        appMinSupportedVersion: true,
        appLatestVersion: true,
        appForceUpdate: true,
        appUpdateUrl: true,
        ordersEnabled: true,
        paymentsEnabled: true,
        promosEnabled: true,
        logoUrl: true,
        logoText: true,
        logoTagline: true,
        updatedAt: true,
      },
    });

    return safeJson(buildPublicSettings(settings), undefined, API_NO_STORE);
  } catch {
    return safeJson(buildPublicSettings(null), undefined, API_NO_STORE);
  }
}
