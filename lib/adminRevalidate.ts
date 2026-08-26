import { revalidatePath, revalidateTag } from "next/cache";

type RevalidateTarget =
  | "home"
  | "games"
  | "products"
  | "settings"
  | "banners"
  | "faqs"
  | "orders"
  | "promoCodes";

function tryRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    if (type) {
      revalidatePath(path, type);
    } else {
      revalidatePath(path);
    }
  } catch (error) {
    console.warn(`[revalidate] path failed: ${path}`, error);
  }
}

function tryRevalidateTag(tag: string) {
  try {
    revalidateTag(tag);
  } catch (error) {
    console.warn(`[revalidate] tag failed: ${tag}`, error);
  }
}

export function revalidateAdminChange(
  target: RevalidateTarget,
  options: { gameSlug?: string | null; orderNumber?: string | null } = {}
) {
  if (target === "home" || target === "banners" || target === "settings") {
    tryRevalidatePath("/");
    tryRevalidateTag("home");
  }

  if (target === "settings") {
    // Root layout contains exchange rate, announcement bar, maintenance gate,
    // and footer support links. Revalidate it so all public pages receive the
    // latest safe website settings after Flutter/admin edits.
    tryRevalidatePath("/", "layout");
    tryRevalidatePath("/faq");
    tryRevalidatePath("/order");
    tryRevalidateTag("settings");
    tryRevalidateTag("public-settings");
  }

  if (target === "banners") {
    tryRevalidateTag("banners");
  }

  if (target === "games") {
    tryRevalidatePath("/");
    tryRevalidatePath("/games");
    if (options.gameSlug) tryRevalidatePath(`/games/${options.gameSlug}`);
    tryRevalidateTag("home");
    tryRevalidateTag("games");
  }

  if (target === "products") {
    tryRevalidatePath("/");
    if (options.gameSlug) tryRevalidatePath(`/games/${options.gameSlug}`);
    tryRevalidateTag("products");
    tryRevalidateTag("games");
  }

  if (target === "faqs") {
    tryRevalidatePath("/faq");
    tryRevalidateTag("faqs");
  }

  if (target === "orders" && options.orderNumber) {
    tryRevalidatePath(`/checkout/${options.orderNumber}`);
    tryRevalidatePath("/order");
    tryRevalidateTag("orders");
  }

  if (target === "promoCodes") {
    tryRevalidateTag("promo-codes");
  }

  tryRevalidateTag(target);
}
