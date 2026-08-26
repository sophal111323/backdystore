"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type PublicDataRefreshProps = {
  scope: "home" | "game" | "games" | "products" | "banners" | "faq" | "faqs" | "settings" | "order";
  slug?: string;
  orderNumber?: string;
  intervalMs?: number;
};

export default function PublicDataRefresh({
  scope,
  slug,
  orderNumber,
  intervalMs = 15000,
}: PublicDataRefreshProps) {
  const router = useRouter();
  const pathname = usePathname();
  const lastVersionRef = useRef<string | null>(null);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;

    let cancelled = false;
    const safeInterval = Math.max(5000, intervalMs);

    async function checkVersion() {
      try {
        const params = new URLSearchParams({ scope });
        if (slug) params.set("slug", slug);
        if (orderNumber) params.set("orderNumber", orderNumber);

        const res = await fetch(`/api/public/version?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok || cancelled) return;

        const data = (await res.json()) as { version?: string };
        const nextVersion = String(data.version || "");
        if (!nextVersion) return;

        if (!lastVersionRef.current) {
          lastVersionRef.current = nextVersion;
          return;
        }

        if (nextVersion !== lastVersionRef.current && !refreshingRef.current) {
          lastVersionRef.current = nextVersion;
          refreshingRef.current = true;
          router.refresh();
          window.setTimeout(() => {
            refreshingRef.current = false;
          }, 1200);
        }
      } catch {
        // Public refresh must never break the page.
      }
    }

    checkVersion();
    const timer = window.setInterval(checkVersion, safeInterval);

    const onFocus = () => checkVersion();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkVersion();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, orderNumber, pathname, router, scope, slug]);

  return null;
}
