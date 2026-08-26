"use client";

import { useCurrency } from "@/lib/currency";

export default function CurrencyToggle({ className = "" }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();

  return (
    <div
      className={`relative inline-flex items-center rounded-full border border-pink-200 bg-white/80 p-0.5 text-xs font-semibold backdrop-blur-sm ${className}`}
      role="group"
      aria-label="Select display currency"
    >
      {/* Sliding highlight */}
      <span
        className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-gradient-to-r from-pink-500 to-pink-300 shadow-md shadow-pink-300/30 transition-transform duration-300 ease-out ${
          currency === "KHR" ? "translate-x-[calc(100%+0px)]" : "translate-x-0"
        }`}
        aria-hidden
      />
      <button
        type="button"
        onClick={() => setCurrency("USD")}
        className={`relative z-10 px-3 py-1 rounded-full transition-colors ${
          currency === "USD" ? "text-black" : "text-pink-500 hover:text-pink-800"
        }`}
        aria-pressed={currency === "USD"}
      >
        ដុល្លារ
      </button>
      <button
        type="button"
        onClick={() => setCurrency("KHR")}
        className={`relative z-10 px-3 py-1 rounded-full transition-colors ${
          currency === "KHR" ? "text-black" : "text-pink-500 hover:text-pink-800"
        }`}
        aria-pressed={currency === "KHR"}
      >
        រៀល
      </button>
    </div>
  );
}
