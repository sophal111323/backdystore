"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  ctaLabel: string | null;
}

export default function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [sliding, setSliding] = useState(false);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      const nextIndex = (current + 1) % banners.length;
      setNext(nextIndex);
      setSliding(true);
      setTimeout(() => {
        setCurrent(nextIndex);
        setNext(null);
        setSliding(false);
      }, 600);
    }, 2000);
    return () => clearInterval(timer);
  }, [banners.length, current]);

  if (banners.length === 0) return null;

  const renderCard = (banner: Banner) => {
    const hasText = Boolean(banner.title?.trim() || banner.subtitle?.trim() || banner.ctaLabel?.trim());

    return (
      <div className="relative h-44 sm:h-60 lg:h-72 w-full shrink-0 rounded-2xl border-2 border-pink-200 shadow-md shadow-pink-200/40 overflow-hidden bg-pink-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner.imageUrl}
          alt={banner.title || "Banner"}
          className="h-full w-full object-cover object-center"
          draggable={false}
        />
        {hasText && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
              {banner.title && (
                <h3 className="font-display text-xs sm:text-base font-bold text-white drop-shadow line-clamp-1">
                  {banner.title}
                </h3>
              )}
              {banner.subtitle && (
                <p className="text-[11px] sm:text-xs text-white/80 mt-0.5 line-clamp-1">{banner.subtitle}</p>
              )}
              {banner.ctaLabel && (
                <span className="mt-1.5 inline-flex items-center rounded-lg bg-pink-500 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-white shadow">
                  {banner.ctaLabel}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="relative mx-auto max-w-5xl px-4 sm:px-6" style={{ overflow: "hidden" }}>
      <div
        className="flex"
        style={{
          transform: sliding ? "translateX(-50%)" : "translateX(0)",
          transition: sliding ? "transform 0.6s ease-in-out" : "none",
          width: sliding ? "200%" : "100%",
        }}
      >
        <div style={{ width: sliding ? "50%" : "100%" }}>
          {banners[current].linkUrl ? (
            <Link href={banners[current].linkUrl!} className="block">{renderCard(banners[current])}</Link>
          ) : renderCard(banners[current])}
        </div>
        {sliding && next !== null && (
          <div style={{ width: "50%" }}>
            {banners[next].linkUrl ? (
              <Link href={banners[next].linkUrl!} className="block">{renderCard(banners[next])}</Link>
            ) : renderCard(banners[next])}
          </div>
        )}
      </div>
    </div>
  );
}