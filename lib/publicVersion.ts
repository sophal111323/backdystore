import { prisma } from "@/lib/prisma";

export type PublicVersionScope =
  | "home"
  | "game"
  | "games"
  | "products"
  | "banners"
  | "faq"
  | "faqs"
  | "settings"
  | "order";

function maxTime(values: Array<Date | null | undefined>): number {
  return values.reduce((max, value) => {
    const time = value ? value.getTime() : 0;
    return time > max ? time : max;
  }, 0);
}

function versionFromTime(scope: string, time: number): string {
  return `${scope}:${time || 0}`;
}

export async function getPublicDataVersion(options: {
  scope: PublicVersionScope;
  slug?: string | null;
  orderNumber?: string | null;
}) {
  const scope = options.scope;

  if (scope === "settings") {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
      select: { updatedAt: true },
    });

    return versionFromTime(scope, settings?.updatedAt?.getTime() ?? 0);
  }

  if (scope === "faq" || scope === "faqs") {
    const faqs = await prisma.faq.aggregate({ _max: { updatedAt: true } });
    return versionFromTime("faqs", faqs._max.updatedAt?.getTime() ?? 0);
  }

  if (scope === "banners") {
    const banners = await prisma.heroBanner.aggregate({ _max: { updatedAt: true } });
    return versionFromTime(scope, banners._max.updatedAt?.getTime() ?? 0);
  }

  if (scope === "products") {
    const [products, games] = await Promise.all([
      prisma.product.aggregate({ _max: { updatedAt: true } }),
      prisma.game.aggregate({ _max: { updatedAt: true } }),
    ]);

    return versionFromTime(
      scope,
      maxTime([products._max.updatedAt, games._max.updatedAt])
    );
  }

  if (scope === "games") {
    const games = await prisma.game.aggregate({ _max: { updatedAt: true } });
    return versionFromTime(scope, games._max.updatedAt?.getTime() ?? 0);
  }

  if (scope === "game") {
    const slug = options.slug?.trim();
    if (!slug || !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(slug)) {
      return versionFromTime(scope, 0);
    }

    const game = await prisma.game.findUnique({
      where: { slug },
      select: { id: true, updatedAt: true },
    });

    if (!game) return versionFromTime(`${scope}:${slug}:missing`, 0);

    const products = await prisma.product.aggregate({
      where: { gameId: game.id },
      _max: { updatedAt: true },
    });

    return versionFromTime(
      `${scope}:${slug}`,
      maxTime([game.updatedAt, products._max.updatedAt])
    );
  }

  if (scope === "order") {
    const orderNumber = options.orderNumber?.trim().toUpperCase();
    if (!orderNumber || !/^[A-Z0-9-]{3,40}$/.test(orderNumber)) {
      return versionFromTime(scope, 0);
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { updatedAt: true, status: true },
    });

    return `${scope}:${orderNumber}:${order?.status || "missing"}:${
      order?.updatedAt?.getTime() ?? 0
    }`;
  }

  const [settings, games, products, banners] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 }, select: { updatedAt: true } }),
    prisma.game.aggregate({ _max: { updatedAt: true } }),
    prisma.product.aggregate({ _max: { updatedAt: true } }),
    prisma.heroBanner.aggregate({ _max: { updatedAt: true } }),
  ]);

  return versionFromTime(
    "home",
    maxTime([
      settings?.updatedAt,
      games._max.updatedAt,
      products._max.updatedAt,
      banners._max.updatedAt,
    ])
  );
}
