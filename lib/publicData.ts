import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const rawPublicRevalidateSeconds = Number(
  process.env.PUBLIC_DATA_REVALIDATE_SECONDS || 10
);

export const PUBLIC_DATA_REVALIDATE_SECONDS =
  Number.isFinite(rawPublicRevalidateSeconds) && rawPublicRevalidateSeconds > 0
    ? rawPublicRevalidateSeconds
    : 10;

export const getPublicSettings = unstable_cache(
  async () => {
    const settings = await prisma.settings
      .findUnique({
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
      })
      .catch(() => null);

    return {
      siteName: settings?.siteName || "JASMIN TOPUP",
      exchangeRate: settings?.exchangeRate ?? 4100,
      supportTelegram: settings?.supportTelegram || "@jasmintopup",
      supportTikTok: settings?.supportTikTok || "",
      supportEmail: settings?.supportEmail || null,
      maintenanceMode: settings?.maintenanceMode ?? false,
      maintenanceMessage:
        settings?.maintenanceMessage ||
        "Server កំពុងថែទាំបណ្តោះអាសន្ន។ សូមរង់ចាំប្រហែល 30 នាទី។",
      announcementEnabled: Boolean(
        settings?.announcementEnabled && settings?.announcement?.trim()
      ),
      announcementText: settings?.announcement || "",
      announcement: settings?.announcement || null,
      announcementTone: settings?.announcementTone || "info",
      appConfig: {
        minSupportedVersion: settings?.appMinSupportedVersion || "1.0.0",
        latestVersion: settings?.appLatestVersion || "1.0.0",
        forceUpdate: settings?.appForceUpdate ?? false,
        updateUrl: settings?.appUpdateUrl || "",
      },
      featureFlags: {
        ordersEnabled: settings?.ordersEnabled ?? true,
        paymentsEnabled: settings?.paymentsEnabled ?? true,
        promosEnabled: settings?.promosEnabled ?? true,
      },
      logoUrl: settings?.logoUrl || "/jasmintopup-logo.png",
      logoText: settings?.logoText || "JASMINTOPUP",
      logoTagline: settings?.logoTagline || "Instant · Secure · 24/7",
      updatedAt: settings?.updatedAt ?? null,
    };
  },
  ["public-settings-v2"],
  {
    tags: ["settings", "public-settings"],
    revalidate: PUBLIC_DATA_REVALIDATE_SECONDS,
  }
);

export const getPublicHomeData = unstable_cache(
  async () => {
    const [games, banners] = await Promise.all([
      prisma.game.findMany({
        where: { active: true },
        orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          publisher: true,
          currencyName: true,
          imageUrl: true,
          featured: true,
        },
      }),
      prisma.heroBanner.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          subtitle: true,
          imageUrl: true,
          linkUrl: true,
          ctaLabel: true,
        },
      }),
    ]);

    return { games, banners };
  },
  ["public-home-v2"],
  {
    tags: ["home", "games", "banners"],
    revalidate: PUBLIC_DATA_REVALIDATE_SECONDS,
  }
);

export const getPublicFaqs = unstable_cache(
  async () => {
    return prisma.faq.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        sortOrder: true,
      },
    });
  },
  ["public-faqs-v2"],
  {
    tags: ["faqs"],
    revalidate: PUBLIC_DATA_REVALIDATE_SECONDS,
  }
);

const getCachedPublicGameBySlug = unstable_cache(
  async (slug: string) => {
    return prisma.game.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        publisher: true,
        description: true,
        imageUrl: true,
        bannerUrl: true,
        currencyName: true,
        uidLabel: true,
        uidExample: true,
        requiresServer: true,
        servers: true,
        active: true,
        seoTitle: true,
        seoDescription: true,
        updatedAt: true,
        products: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            amount: true,
            bonus: true,
            priceUsd: true,
            badge: true,
            imageUrl: true,
            updatedAt: true,
          },
        },
      },
    });
  },
  ["public-game-by-slug-v2"],
  {
    tags: ["games", "products"],
    revalidate: PUBLIC_DATA_REVALIDATE_SECONDS,
  }
);

export function getPublicGameBySlug(slug: string) {
  return getCachedPublicGameBySlug(slug);
}
