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

  const renderCard = (banner: Banner) => (
    <div className="relative h-52 sm:h-72 lg:h-80 w-full shrink-0 rounded-2xl border-2 border-pink-200 shadow-md shadow-pink-100/60 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={banner.imageUrl}
        alt={banner.title}
        className="h-full w-full object-cover"
        draggable={false}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
        <h3 className="font-display text-sm sm:text-base lg:text-lg font-bold text-white drop-shadow line-clamp-1">
          {banner.title}
        </h3>
        {banner.subtitle && (
          <p className="text-xs text-white/75 mt-0.5 line-clamp-1">{banner.subtitle}</p>
        )}
        {banner.ctaLabel && (
          <span className="mt-2 inline-flex items-center rounded-lg bg-pink-500 px-3 py-1 text-xs font-bold text-white shadow">
            {banner.ctaLabel}
          </span>
        )}
      </div>
    </div>
  );

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