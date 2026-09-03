"use client";

import Image from "next/image";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { isValidUid, isValidServerId, formatUsd } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";
import { QrCode, ArrowRight, Lock, Check, Smartphone, Search, UserRoundCheck, AlertCircle, Tag, Loader2,  } from "lucide-react";
import KHQRBottomSheet from "@/components/KHQRBottomSheet";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

// Games that support automatic nickname lookup via /api/lookup-uid
const LOOKUP_SLUGS = new Set(["mobile-legends", "free-fire", "honor-of-king", "honor-of-kings", "pubg-mobile", "pubgm", "pubgm-lite", "blood-strike", "magic-chess", "magic-chess-go", "mcgg", "ro-blox"]);
// MLBB & similar games that use a separate "Zone ID" instead of a server dropdown
const ZONE_ID_SLUGS = new Set(["mobile-legends", "magic-chess", "magic-chess-go", "mcgg"]);

const DISMISS_KEY = "topup_bar_dismissed";

interface Product {
  id: string;
  name: string;
  amount: number;
  bonus: number;
  priceUsd: number;
  badge: string | null;
  category?: string | null;
  imageUrl: string | null;
}

interface Game {
  id: string;
  slug: string;
  name: string;
  currencyName: string;
  uidLabel: string;
  uidExample: string | null;
  requiresServer: boolean;
  servers: string[];
  categoryOrder?: string[];
}

export default function TopUpForm({ game, products }: { game: Game; products: Product[] }) {
  const { format, currency } = useCurrency();
  const [selected, setSelected] = useState<string | null>(null);
  const [uid, setUid] = useState("");
  const [serverId, setServerId] = useState(
    ZONE_ID_SLUGS.has(game.slug) ? "" : (game.servers[0] ?? "")
  );
  const [paymentPopup, setPaymentPopup] = useState<any | null>(null);
  const [method, setMethod] = useState<"TOLASAINT">("TOLASAINT");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🛡️ Cloudflare Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_PUBLIC ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    (process.env.NODE_ENV !== "production" ? "1x00000000000000000000AA" : "");

  // Dismissed state — persists across page refresh via sessionStorage
  const [dismissed, setDismissed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);

  // Group products by category and sort according to game.categoryOrder (Slot 1, Slot 2, ...)
  const groupedProducts = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const cat = (p.category || "").trim() || "Diamonds";
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(p);
    }

    const catOrder = Array.isArray(game.categoryOrder) ? game.categoryOrder : [];
    const entries = Array.from(map.entries());

    if (catOrder.length > 0) {
      entries.sort(([catA], [catB]) => {
        const indexA = catOrder.indexOf(catA);
        const indexB = catOrder.indexOf(catB);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      });
    }

    return entries.map(([category, items]) => ({
      category,
      items,
    }));
  }, [products, game.categoryOrder]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    }
  }, []);

  function dismissBar() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISS_KEY, "1");
    }
    setDismissed(true);
  }

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<{
    code: string;
    discountUsd: number;
    finalAmountUsd: number;
    discountType: string;
    discountValue: number;
  } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const supportsLookup = LOOKUP_SLUGS.has(game.slug);
  const useZoneField = ZONE_ID_SLUGS.has(game.slug);

  type NicknameStatus = "idle" | "checking" | "verified" | "not_found";
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>("idle");
  const [nickname, setNickname] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resetLookup = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setNicknameStatus("idle");
    setNickname(null);
  }, []);

  // 💾 Auto-load saved player ID, serverId, and verified nickname from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`dytopup_player_${game.slug}`);
      if (saved) {
        const data = JSON.parse(saved);
        if (data?.uid && typeof data.uid === "string") {
          setUid(data.uid);
          if (data.serverId && typeof data.serverId === "string") {
            setServerId(data.serverId);
          }
          if (data.nickname && typeof data.nickname === "string") {
            setNickname(data.nickname);
            setNicknameStatus("verified");
          }
        }
      }
    } catch {}
  }, [game.slug]);

  // 💾 Helper to save player details to localStorage
  const savePlayerToStorage = useCallback(
    (newUid: string, newServerId?: string, newNickname?: string | null) => {
      try {
        if (!newUid.trim()) return;
        localStorage.setItem(
          `dytopup_player_${game.slug}`,
          JSON.stringify({
            uid: newUid.trim(),
            serverId: (newServerId !== undefined ? newServerId : serverId).trim(),
            nickname: newNickname !== undefined ? newNickname : nickname,
            updatedAt: Date.now(),
          })
        );
      } catch {}
    },
    [game.slug, serverId, nickname]
  );

  const handleCheckNickname = useCallback(async () => {
    if (!supportsLookup) return;
    if (!isValidUid(uid)) return;
    if (useZoneField && serverId.trim().length === 0) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setNicknameStatus("checking");
    setNickname(null);

    try {
      const res = await fetch("/api/lookup-uid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameSlug: game.slug,
          uid: uid.trim(),
          server: serverId.trim() || undefined,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (data.verified && data.nickname) {
        setNickname(data.nickname);
        setNicknameStatus("verified");
        savePlayerToStorage(uid, serverId, data.nickname);
      } else {
        setNicknameStatus("not_found");
      }
    } catch {
      if (!controller.signal.aborted) {
        setNicknameStatus("not_found");
      }
    }
  }, [uid, serverId, game.slug, supportsLookup, useZoneField, savePlayerToStorage]);

  const selectedProduct = products.find((p) => p.id === selected);
  const needsServer = game.requiresServer || useZoneField;
  const needsNickname = supportsLookup;
  const canSubmit =
    !!selected &&
    isValidUid(uid) &&
    (!needsServer || serverId.trim().length > 0) &&
    (!needsNickname || nicknameStatus === "verified") &&
    termsAccepted &&
    (!turnstileSiteKey || !!turnstileToken);

  async function applyPromo() {
    if (!promoInput.trim() || !selectedProduct) return;
    setPromoLoading(true);
    setPromoError(null);
    setPromoApplied(null);
    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promoInput.trim(),
          orderAmountUsd: selectedProduct.priceUsd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid promo code");
      setPromoApplied(data);
    } catch (err: any) {
      setPromoError(err.message);
    } finally {
      setPromoLoading(false);
    }
  }

  function removePromo() {
    setPromoApplied(null);
    setPromoInput("");
    setPromoError(null);
  }

  const effectivePrice = promoApplied ? promoApplied.finalAmountUsd : (selectedProduct?.priceUsd ?? 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    if (turnstileSiteKey && !turnstileToken) {
      setError("សូមផ្ទៀងផ្ទាត់សុវត្ថិភាព (Turnstile Bot Check) ជាមុនសិន។");
      return;
    }

    setSubmitting(true);
    setError(null);
    savePlayerToStorage(uid.trim(), needsServer ? serverId.trim() : undefined, nickname);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          productId: selected,
          playerUid: uid.trim(),
          serverId: needsServer ? serverId.trim() : undefined,
          paymentMethod: method,
          promoCode: promoApplied?.code || undefined,
          playerNickname: nickname || undefined,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        turnstileRef.current?.reset();
        setTurnstileToken(null);
        throw new Error(data.error || "Failed to create order");
      }

      const orderNumber = data.orderNumber || data.order?.orderNumber;

      if (!orderNumber) {
        turnstileRef.current?.reset();
        setTurnstileToken(null);
        throw new Error("Order number not returned from API");
      }

      // ✅ Get order detail + KHQR data
      const orderRes = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
        cache: "no-store",
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        turnstileRef.current?.reset();
        setTurnstileToken(null);
        throw new Error(orderData.error || "Failed to load payment QR");
      }

      // ✅ Open KHQR popup instead of redirect
      setPaymentPopup(orderData);
      setSubmitting(false);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setSubmitting(false);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-8">
        {/* Left column */}
        <div className="space-y-5 sm:space-y-6">

          {/* Step 1 */}
          <div className="fade-up">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white shadow-md shadow-pink-300/40" style={{background:"linear-gradient(135deg,#E91E8C,#FF6EB4)"}}>
                <span className="absolute inset-0 rounded-full bg-pink-500/40 animate-ping" />
                <span className="relative">1</span>
              </div>
              <h2 className="font-display text-lg font-extrabold text-pink-800">បញ្ចូលព័ត៌មានគណនី</h2>
            </div>

            <div className="card p-3.5 sm:p-4 space-y-3">
              <div className={useZoneField ? "grid grid-cols-[1fr_110px] sm:grid-cols-[1fr_130px] gap-3" : ""}>
                <div>
                  <label className="label text-xs sm:text-sm mb-1">
                    {useZoneField ? "User ID" : game.uidLabel}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={uid}
                    onChange={(e) => { setUid(e.target.value); resetLookup(); }}
                    onBlur={() => {
                      if (isValidUid(uid)) {
                        savePlayerToStorage(uid, serverId);
                      }
                    }}
                    placeholder={useZoneField ? "12345678" : (game.uidExample || "Enter your player ID")}
                    className="input font-mono text-sm sm:text-base py-2.5"
                    required
                  />
                  {!uid && game.uidExample && !useZoneField && (
                    <p className="text-xs text-pink-500 mt-1">
                      ឧទាហរណ៍: <span className="font-mono text-pink-800/70">{game.uidExample}</span>
                    </p>
                  )}
                  {uid && !isValidUid(uid) && (
                    <p className="text-xs text-red-500 mt-1">IDគួរតែ6-20ខ្ទង់</p>
                  )}
                </div>
                {useZoneField && (
                  <div>
                    <label className="label text-xs sm:text-sm mb-1">Zone ID</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={serverId}
                      onChange={(e) => setServerId(e.target.value)}
                      onBlur={() => {
                        if (isValidUid(uid)) {
                          savePlayerToStorage(uid, serverId);
                        }
                      }}
                      placeholder="1234"
                      className="input font-mono text-sm sm:text-base py-2.5"
                      required
                    />
                  </div>
                )}
              </div>

              {game.requiresServer && !useZoneField && (
                <div>
                  <label className="label text-xs sm:text-sm mb-1">Server</label>
                  <select
                    value={serverId}
                    onChange={(e) => setServerId(e.target.value)}
                    className="input text-sm py-2"
                    required
                  >
                    {game.servers.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {supportsLookup && (
                <div className="pt-0.5 flex flex-wrap items-center gap-2 sm:gap-2.5">
                  <button
                    type="button"
                    onClick={handleCheckNickname}
                    disabled={
                      !isValidUid(uid) ||
                      (useZoneField && serverId.trim().length === 0) ||
                      nicknameStatus === "checking"
                    }
                    className="btn-ghost text-xs py-1.5 px-3.5 inline-flex items-center gap-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {nicknameStatus === "checking" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    ) : (
                      <Search className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                    {nicknameStatus === "checking" ? "កំពុងពិនិត្យ…" : "ពិនិត្យមើលឈ្មោះ"}
                  </button>

                  {nicknameStatus === "verified" && nickname && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-600 bg-green-100 px-2.5 py-1 text-xs text-green-600 animate-scale-in">
                      <UserRoundCheck className="h-3.5 w-3.5 shrink-0 text-green-600" strokeWidth={2} />
                      <span className="text-pink-500 font-medium">Player:</span>
                      <span className="font-bold text-green-800">{nickname}</span>
                    </span>
                  )}
                  {nicknameStatus === "not_found" && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500 bg-red-50 px-2.5 py-1 text-xs text-red-600">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      គណនីរកមិនឃើញ — សូមពិនិត្យ ID ម្តងទៀត
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ✅ Step 2: Pick Package — Categorized with Original Card Design */}
          <div className="fade-up" style={{ animationDelay: "80ms" }}>
            <div className="flex items-center gap-3 mb-5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full font-extrabold text-white shadow-lg shadow-pink-300/40"
                style={{ background: "linear-gradient(135deg,#E91E8C,#FF6EB4)" }}
              >
                2
              </div>
              <h2 className="font-display text-xl font-extrabold text-pink-800">ជ្រើសរើសកញ្ចប់</h2>
            </div>

            {/* Categorized Sections */}
            <div className="space-y-6">
              {groupedProducts.map((group) => (
                <div key={group.category} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-pink-900 tracking-tight">
                      {group.category}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-100 text-pink-600 border border-pink-200">
                      {group.items.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
                    {group.items.map((p) => {
                      const isSelected = selected === p.id;
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setSelected(p.id)}
                          className={`group relative overflow-hidden text-center rounded-2xl border-2 p-2.5 sm:p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                            isSelected
                              ? "border-pink-400 bg-gradient-to-b from-pink-50 to-white shadow-lg shadow-pink-300/40 ring-2 ring-pink-400/40"
                              : "border-pink-100 bg-white hover:border-pink-300 hover:shadow-pink-200/50"
                          }`}
                          style={{
                            background: isSelected
                              ? "linear-gradient(160deg, #fff0f6 0%, #ffffff 100%)"
                              : undefined,
                          }}
                        >
                          {/* Shimmer on selected */}
                          {isSelected && (
                            <span className="pointer-events-none absolute inset-0 opacity-50">
                              <span className="absolute -inset-y-1 -left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-pink-200/60 to-transparent animate-shimmer" />
                            </span>
                          )}

                          {/* Checkmark top-left */}
                          <span
                            className={`absolute top-2 left-2 flex h-5 w-5 sm:h-5.5 sm:w-5.5 items-center justify-center rounded-full transition-all duration-200 ${
                              isSelected
                                ? "bg-pink-500 shadow-sm shadow-pink-300/50 scale-100"
                                : "bg-pink-100/70 scale-90"
                            }`}
                          >
                            <svg className={`h-3 w-3 transition-colors ${isSelected ? "text-white" : "text-pink-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          </span>

                          {/* Badge */}
                          {p.badge && (
                            <div className="absolute -top-1.5 right-2 z-10">
                              {p.badge === "Hot" && <span className="badge-hot !text-[9px] !px-2 !py-0.5">Hot</span>}
                              {p.badge === "Best Value" && <span className="badge-best !text-[9px] !px-2 !py-0.5">Best</span>}
                              {p.badge === "Pass" && <span className="badge-pass !text-[9px] !px-2 !py-0.5">Pass</span>}
                              {!["Hot", "Best Value", "Pass"].includes(p.badge) && (
                                <span className="badge-best !text-[9px] !px-2 !py-0.5">{p.badge}</span>
                              )}
                            </div>
                          )}

                          {/* Product Image */}
                          {p.imageUrl ? (
                            <div className="flex justify-center mb-1.5 mt-0.5 sm:mb-2 sm:mt-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="h-12 w-12 sm:h-16 sm:w-16 object-contain rounded-lg shadow-sm shadow-pink-200/40 group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          ) : (
                            <div className="flex justify-center mb-1.5 mt-0.5 sm:mb-2 sm:mt-1 text-2xl sm:text-3xl">
                              💎
                            </div>
                          )}

                          {/* Product Name */}
                          <div className="font-bold text-xs sm:text-sm text-pink-800 leading-tight line-clamp-1 mb-0.5">
                            {p.name}
                          </div>
                          {p.bonus > 0 && (
                            <div className="text-[10px] sm:text-xs text-pink-400 font-medium line-clamp-1">
                              + {p.bonus} bonus
                            </div>
                          )}

                          {/* Sparkle divider */}
                          <div className="flex items-center gap-1.5 my-1.5 sm:my-2 px-1">
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-200 to-pink-300" />
                            <svg className="h-2 w-2 text-pink-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                            </svg>
                            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-pink-200 to-pink-300" />
                          </div>

                          {/* Price with sparkles */}
                          <div className="flex items-center justify-center gap-1">
                            <svg className={`h-2.5 w-2.5 shrink-0 transition-colors ${isSelected ? "text-pink-500" : "text-pink-300"}`} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                            </svg>
                            <span className={`font-mono font-extrabold text-sm sm:text-base transition-colors ${isSelected ? "text-pink-600" : "text-pink-500"}`}>
                              {format(p.priceUsd)}
                            </span>
                            <svg className={`h-2.5 w-2.5 shrink-0 transition-colors ${isSelected ? "text-pink-500" : "text-pink-300"}`} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                            </svg>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Promo Code */}
          <div className="fade-up" style={{ animationDelay: "140ms" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pink-50 border border-pink-200 text-pink-500">
                <Tag className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <h3 className="font-display text-sm font-semibold text-pink-500">Have a promo code?</h3>
            </div>

            {promoApplied ? (
              <div className="flex items-center gap-3 rounded-xl border border-green-600 bg-green-100 p-3">
                <Tag className="h-4 w-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-mono font-bold text-green-600 text-sm">{promoApplied.code}</span>
                  <span className="text-xs text-green-600/80 ml-2">−{format(promoApplied.discountUsd)} off</span>
                </div>
                <button type="button" onClick={removePromo} className="text-xs text-pink-500 hover:text-red-500 transition-colors">
                  លុប
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                  placeholder="Enter code"
                  className="input font-mono uppercase text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  disabled={promoLoading || !promoInput.trim() || !selectedProduct}
                  className="btn-ghost text-sm shrink-0"
                >
                  {promoLoading ? "..." : "អនុវត្ត"}
                </button>
              </div>
            )}
            {promoError && <p className="mt-2 text-xs text-red-500">{promoError}</p>}
          </div>

          {/* Step 3: Payment */}
          <div className="fade-up" style={{ animationDelay: "160ms" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full font-extrabold text-white shadow-lg shadow-pink-300/40" style={{background:"linear-gradient(135deg,#E91E8C,#FF6EB4)"}}>
                3
              </div>
              <h2 className="font-display text-xl font-extrabold text-pink-800">Choose Payment</h2>
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setMethod("TOLASAINT")}
                className={`group relative rounded-xl border-2 p-4 sm:p-5 text-left transition-all duration-300 hover:-translate-y-0.5 ${
                  method === "TOLASAINT"
                    ? "border-pink-400 bg-gradient-to-br from-pink-500/15 to-pink-400/5 shadow-lg shadow-pink-300/20"
                    : "border-pink-200 bg-white hover:border-pink-400 hover:shadow-md hover:shadow-pink-200/60"
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-xl overflow-hidden transition-transform duration-300 group-hover:scale-110">
                    <Image
                      src="https://i.ibb.co/ccg3qyF9/images.png"
                      alt="KHQR"
                      width={56}
                      height={56}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm sm:text-base">KHQR</span>
                      <span className="rounded-full border border-green-600 bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-600">Instant</span>
                    </div>
                    <div className="text-xs text-pink-500 mt-0.5">ដំណើរការគ្រប់ធនាគារទាំងអស់នៅកម្ពុជា</div>
                  </div>
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${method === "TOLASAINT" ? "border-pink-500 bg-pink-500" : "border-pink-200"}`}>
                    {method === "TOLASAINT" && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </div>
                </div>
              </button>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-pink-200 bg-white/70 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setTermsAccepted((v) => !v)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                    termsAccepted
                      ? "border-pink-500 bg-pink-500"
                      : "border-pink-300 bg-white"
                  }`}
                  aria-label="Accept terms"
                >
                  {termsAccepted && (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </button>

                <span className="text-xs font-semibold text-pink-600">
                  ខ្ញុំព្រមជាមួយ{" "}
                  <a
                    href="/Terms-of-service"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-pink-800"
                  >
                    លក្ខខណ្ឌ
                  </a>
                </span>
              </div>

              {/* 🛡️ Cloudflare Turnstile Invisible Bot Protection */}
              {turnstileSiteKey && (
                <div className="hidden" aria-hidden="true">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={turnstileSiteKey}
                    options={{
                      size: "invisible",
                      action: "create_order",
                    }}
                    onSuccess={(token) => {
                      setTurnstileToken(token);
                      setError(null);
                    }}
                    onError={() => {
                      setTurnstileToken(null);
                    }}
                    onExpire={() => {
                      setTurnstileToken(null);
                    }}
                  />
                </div>
              )}
            </div>
          </div>

        </div>{/* end left column */}

        {/* Right column: sticky order summary */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <div className="card p-6 border border-pink-400/20">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-pink-500 mb-4">ការបញ្ជាទិញ</h3>

              {selectedProduct ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-pink-500">{game.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-pink-500">កញ្ចប់</span>
                    <span className="font-medium">
                      {selectedProduct.amount > 0
                        ? `${selectedProduct.amount.toLocaleString()} ${game.currencyName}`
                        : selectedProduct.name}
                    </span>
                  </div>
                  {selectedProduct.bonus > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-pink-500">Bonus</span>
                      <span className="text-pink-400 font-semibold">+{selectedProduct.bonus}</span>
                    </div>
                  )}
                  {uid && (
                    <div className="flex justify-between text-sm">
                      <span className="text-pink-500">Player ID:</span>
                      <span className="font-mono text-xs">{uid}{serverId ? ` (${serverId})` : ""}</span>
                    </div>
                  )}
                  {nickname && nickname !== uid.trim() && (
                    <div className="flex justify-between text-sm">
                      <span className="text-pink-500">playerឈ្មោះ:</span>
                      <span className="text-green-600 font-medium text-xs">{nickname}</span>
                    </div>
                  )}
                  <div className="border-t border-pink-200 pt-3 space-y-2">
                    {promoApplied && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-pink-500">តម្លៃរង</span>
                          <span className="text-pink-500 line-through">{format(selectedProduct.priceUsd)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">បញ្ចុះតម្លៃ ({promoApplied.code})</span>
                          <span className="text-green-600 font-semibold">−{format(promoApplied.discountUsd)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-pink-500 text-sm">តម្លៃសរុប</span>
                      <div className="text-right">
                        <span key={`${selectedProduct.id}-${currency}`} className="font-display text-3xl font-extrabold text-pink-600 inline-block">
                          {format(effectivePrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-pink-500">ជ្រើសរើសកញ្ចប់</p>
              )}

              {error && (
                <div className="mt-4 rounded-lg border border-red-600 bg-red-100 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Hint messages when button is disabled */}
              {!selected && (
                <p className="mt-4 text-xs text-pink-400 text-center">👆 សូមជ្រើសរើសកញ្ចប់មុន</p>
              )}
              {selected && needsNickname && nicknameStatus !== "verified" && isValidUid(uid) && (
                <p className="mt-4 text-xs text-pink-400 text-center">🔍 សូមពិនិត្យឈ្មោះ Player មុន</p>
              )}
              {!termsAccepted && (
                <p className="mt-2 text-xs text-pink-400 text-center">
                  សូមចុច ✓ យល់ព្រមលក្ខខណ្ឌមុនបង់ប្រាក់
                </p>
              )}
              {turnstileSiteKey && !turnstileToken && selected && (
                <p className="mt-2 text-xs text-pink-500 text-center font-medium">
                  🛡️ កំពុងផ្ទៀងផ្ទាត់សុវត្ថិភាព…
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="btn-primary w-full text-base mt-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {submitting ? "Creating order..." : "Pay Now"}
                {!submitting && <ArrowRight className="h-5 w-5" strokeWidth={2.5} />}
              </button>

              <p className="flex items-center justify-center gap-1.5 text-xs text-pink-500 text-center mt-3">
                <Lock className="h-3 w-3" strokeWidth={2.5} />
                ទូទាត់ប្រាក់ដោយសុវត្ថិភាព
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom */}
      {!dismissed && (
        <div className="relative lg:hidden card p-3 sm:p-4 sticky bottom-2.5 mt-4 border border-pink-400/30 shadow-xl shadow-pink-300/20 backdrop-blur-md">

          {selectedProduct && (
            <div className="flex justify-between items-center mb-2">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-pink-500 font-medium">តម្លៃសរុប:</span>
                  <span key={`${selectedProduct.id}-${currency}`} className="font-display text-xl font-extrabold text-pink-600">
                    {format(effectivePrice)}
                  </span>
                </div>
                {promoApplied && (
                  <div className="text-[10px] text-green-600 font-medium">−{format(promoApplied.discountUsd)} off</div>
                )}
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-pink-100/80 text-xs font-bold text-pink-700">
                  {selectedProduct.amount > 0
                    ? `${selectedProduct.amount.toLocaleString()} ${game.currencyName}`
                    : selectedProduct.name}
                </span>
                {selectedProduct.bonus > 0 && (
                  <div className="text-[10px] text-pink-400 font-medium">+ {selectedProduct.bonus} bonus</div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-2 rounded-lg border border-red-500 bg-red-50 p-2 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Mobile hint messages */}
          {!selected && (
            <p className="mb-1.5 text-xs text-pink-500 text-center font-medium">👆 សូមជ្រើសរើសកញ្ចប់មុន</p>
          )}
          {!termsAccepted && (
            <p className="mb-1.5 text-xs text-pink-500 text-center font-medium">
              សូមចុច ✓ យល់ព្រមលក្ខខណ្ឌមុនបង់ប្រាក់
            </p>
          )}
          {selected && needsNickname && nicknameStatus !== "verified" && isValidUid(uid) && (
            <p className="mb-1.5 text-xs text-pink-500 text-center font-medium">🔍 សូមពិនិត្យឈ្មោះ Player មុន</p>
          )}
          {turnstileSiteKey && !turnstileToken && selected && (
            <p className="mb-1.5 text-xs text-pink-500 text-center font-medium">
              🛡️ កំពុងផ្ទៀងផ្ទាត់សុវត្ថិភាព…
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="btn-primary w-full !py-2.5 text-sm font-extrabold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {submitting ? "Creating order..." : "Pay Now"}
            {!submitting && <ArrowRight className="h-4 w-4" strokeWidth={2.5} />}
          </button>

          <p className="flex items-center justify-center gap-1 text-[10px] text-pink-500 text-center mt-1.5">
            <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
            ទូទាត់ប្រាក់ដោយសុវត្ថិភាព
          </p>
        </div>
      )}

      {paymentPopup && (
        <KHQRBottomSheet
          order={paymentPopup}
          onClose={() => setPaymentPopup(null)}
        />
      )}
    </form>
  );
}