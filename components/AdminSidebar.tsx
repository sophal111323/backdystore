"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { useEffect, useMemo, useState } from "react";

const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/orders", label: "Orders", icon: "📦" },
  { href: "/admin/games", label: "Games", icon: "🎮" },
  { href: "/admin/products", label: "Products", icon: "💎" },
  { href: "/admin/promo-codes", label: "Promo Codes", icon: "🏷️" },
  { href: "/admin/banners", label: "Banners", icon: "🖼️" },
  { href: "/admin/faqs", label: "FAQ", icon: "❓" },
  { href: "/admin/blog", label: "Blog", icon: "📝" },
  { href: "/admin/customers", label: "Customers", icon: "👥" },
  { href: "/admin/banlist", label: "Banlist", icon: "🚫" },
  { href: "/admin/security", label: "Security", icon: "🛡️" },
  { href: "/admin/audit-logs", label: "Audit Log", icon: "📜" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

function getActiveIndex(pathname: string | null, optimisticHref: string | null) {
  const currentPath = optimisticHref || pathname || "/admin";

  const exactIndex = ADMIN_NAV_ITEMS.findIndex((item) => item.href === currentPath);
  if (exactIndex !== -1) return exactIndex;

  const nestedIndex = ADMIN_NAV_ITEMS.findIndex((item) => {
    if (item.href === "/admin") return false;
    return currentPath.startsWith(`${item.href}/`);
  });

  return nestedIndex === -1 ? 0 : nestedIndex;
}

export default function AdminSidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticHref(null);
  }, [pathname]);

  const activeIndex = useMemo(
    () => getActiveIndex(pathname, optimisticHref),
    [pathname, optimisticHref],
  );

  return (
    <aside className="admin-sidebar group relative flex h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-pink-200/80 bg-pink-50/80 text-pink-900 shadow-[18px_0_48px_rgba(233,30,140,0.10)] backdrop-blur-xl">
      <div className="pointer-events-none absolute -left-16 top-10 h-40 w-40 rounded-full bg-pink-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-48 w-48 rounded-full bg-pink-400/20 blur-3xl" />

      <Link
        href="/admin"
        onPointerDown={() => setOptimisticHref("/admin")}
        className="relative z-10 border-b border-pink-200/90 px-5 py-5 transition-all duration-300 hover:bg-white/45"
      >
        <div className="flex items-center gap-3 rounded-2xl bg-white/55 p-3 shadow-sm shadow-pink-200/60 ring-1 ring-pink-200/80 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-pink-200/70">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white p-1 shadow-inner shadow-pink-100 ring-2 ring-pink-200">
            <Image
              src="/jasmintopup-logo.png"
              alt="JASMINTOPUP Logo"
              width={48}
              height={48}
              className="h-full w-full rounded-xl object-contain"
              priority
            />
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/0 via-white/30 to-pink-200/20" />
          </div>

          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-[15px] font-black tracking-wide text-pink-900">
              JASMIN<span className="text-pink-500">TOPUP</span>
            </div>
            <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.24em] text-pink-500">
              Admin Panel
            </div>
          </div>
        </div>
      </Link>

      <nav className="relative z-10 flex-1 overflow-y-auto px-3 py-4">
        <div className="relative space-y-1.5">
          <span
            aria-hidden="true"
            className="admin-sidebar-indicator absolute left-0 right-0 top-0 h-11 rounded-2xl border border-pink-300/90 bg-white/85 shadow-[0_10px_30px_rgba(233,30,140,0.16)] ring-1 ring-white/70"
            style={{ transform: `translate3d(0, ${activeIndex * 50}px, 0)` }}
          />

          {ADMIN_NAV_ITEMS.map((item, index) => {
            const isActive = index === activeIndex;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onPointerDown={() => setOptimisticHref(item.href)}
                className={[
                  "admin-nav-link group/nav relative z-10 flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-bold outline-none transition-all duration-300",
                  "focus-visible:ring-4 focus-visible:ring-pink-200/80",
                  isActive
                    ? "translate-x-1 text-pink-700"
                    : "text-pink-900/70 hover:translate-x-1 hover:text-pink-700",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-base transition-all duration-300",
                    isActive
                      ? "bg-pink-100 shadow-inner shadow-pink-200/70 scale-105"
                      : "bg-white/35 group-hover/nav:bg-white/70",
                  ].join(" ")}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-pink-500 shadow-[0_0_14px_rgba(233,30,140,0.65)]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="relative z-10 border-t border-pink-200/80 p-4">
        <div className="rounded-2xl bg-white/55 p-3 shadow-sm shadow-pink-200/50 ring-1 ring-pink-200/70">
          <div className="text-[11px] font-bold uppercase tracking-wider text-pink-500/90">
            Signed in as
          </div>
          <div className="mt-1 truncate text-sm font-extrabold text-pink-900">
            {adminEmail}
          </div>
          <div className="mt-3 border-t border-pink-200 pt-3">
            <LogoutButton />
          </div>
        </div>
      </div>
    </aside>
  );
}
