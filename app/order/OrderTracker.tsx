"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Package,
  CheckCircle2,
  XCircle,
  Truck,
  CreditCard,
  Send,
  Copy,
  Check,
} from "lucide-react";

interface OrderInfo {
  orderNumber: string;
  status: string;
  gameName: string;
  productName: string;
  playerUidMasked: string | null;
  serverIdMasked?: string | null;
  amountUsd: number;
  paymentMethod: string;
  createdAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
}

const TIMELINE_STEPS = [
  { key: "PENDING", label: "Order Created", Icon: Package },
  { key: "PAID", label: "Payment Received", Icon: CreditCard },
  { key: "DELIVERED", label: "Delivered", Icon: Truck },
];

const STATUS_ORDER: Record<string, number> = {
  PENDING: 0,
  PAID: 1,
  PROCESSING: 1,
  DELIVERED: 2,
  FAILED: -1,
  REFUNDED: -1,
  CANCELLED: -1,
};

const STATUS_META: Record<
  string,
  { label: string; color: string; desc: string }
> = {
  PENDING: {
    label: "រង់ចាំការទូទាត់",
    color: "text-yellow-600 border-yellow-300 bg-yellow-100",
    desc: "កំពុងរង់ចាំការទូទាត់របស់អ្នក",
  },
  PAID: {
    label: "ទទួលបានការទូទាត់",
    color: "text-blue-600 border-blue-300 bg-blue-100",
    desc: "កំពុងដំណើរការ Top-Up",
  },
  PROCESSING: {
    label: "កំពុងដំណើរការ",
    color: "text-blue-600 border-blue-300 bg-blue-100",
    desc: "ដឹកជញ្ជូន Credits ទៅគណនីរបស់អ្នក",
  },
  DELIVERED: {
    label: "Delivered",
    color: "text-green-600 border-green-400/40 bg-green-400/10",
    desc: "Credits sent to your account!",
  },
  FAILED: {
    label: "Failed",
    color: "text-red-500 border-red-400/40 bg-red-400/10",
    desc: "Something went wrong — contact support",
  },
  REFUNDED: {
    label: "Refunded",
    color: "text-pink-500 border-pink-200 bg-white",
    desc: "Order refunded",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "text-pink-500 border-pink-200 bg-white",
    desc: "Order was cancelled",
  },
};

const DEFAULT_STATUS_META = {
  label: "Unknown",
  color: "text-pink-500 border-pink-200 bg-white",
  desc: "Unknown order status",
};

const TERMINAL_STATUSES = new Set([
  "DELIVERED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
]);

function normalizeStatus(status?: string | null) {
  return String(status || "").trim().toUpperCase();
}

function cleanOrderNumber(value: string) {
  return value.trim().toUpperCase();
}

export default function OrderTracker() {
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedOrder, setCopiedOrder] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoLoadedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchOrder = useCallback(async (orderNum: string) => {
    const clean = cleanOrderNumber(orderNum);

    const res = await fetch(`/api/orders/status?orderNumber=${encodeURIComponent(clean)}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Order not found");
    }

    const data: OrderInfo = await res.json();
    return data;
  }, []);

  const syncPayment = useCallback(async (_orderNum: string) => {
    // Public order page is read-only. Payment status is changed by backend webhook/verification only.
  }, []);

  const startPolling = useCallback(
    (orderNum: string) => {
      stopPolling();

      pollRef.current = setInterval(async () => {
        try {
          await syncPayment(orderNum);

          const data = await fetchOrder(orderNum);
          const status = normalizeStatus(data.status);

          setOrder(data);

          if (TERMINAL_STATUSES.has(status)) {
            stopPolling();
          }
        } catch {
          // Silent polling error
        }
      }, 10000);
    },
    [fetchOrder, stopPolling, syncPayment]
  );


  const loadOrderByNumber = useCallback(
    async (rawOrderNumber: string, options?: { silent?: boolean }) => {
      const clean = cleanOrderNumber(rawOrderNumber);
      if (!clean) return;

      if (!options?.silent) {
        setLoading(true);
        setError(null);
        setOrder(null);
      }

      try {
        await syncPayment(clean);

        const data = await fetchOrder(clean);
        const status = normalizeStatus(data.status);

        setOrder(data);
        setOrderNumber(data.orderNumber);

        if (!TERMINAL_STATUSES.has(status)) {
          startPolling(data.orderNumber);
        } else {
          stopPolling();
        }
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : "Order not found");
        }
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [fetchOrder, startPolling, syncPayment, stopPolling]
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const initialOrderNumber =
      params.get("orderNumber") || params.get("order") || params.get("q");

    if (!initialOrderNumber) return;

    const clean = cleanOrderNumber(initialOrderNumber);
    setOrderNumber(clean);
    void loadOrderByNumber(clean);
  }, [loadOrderByNumber]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    await loadOrderByNumber(orderNumber);
  }

  async function copyOrderNumber() {
    if (!order?.orderNumber) return;

    try {
      await navigator.clipboard.writeText(order.orderNumber);
    } catch {
      const input = document.createElement("input");
      input.value = order.orderNumber;
      input.setAttribute("readonly", "true");
      input.style.position = "absolute";
      input.style.left = "-9999px";

      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }

    setCopiedOrder(true);
    window.setTimeout(() => setCopiedOrder(false), 1800);
  }

  const orderStatus = order ? normalizeStatus(order.status) : "";
  const meta = order
    ? STATUS_META[orderStatus] ?? DEFAULT_STATUS_META
    : null;

  const currentStep = order ? STATUS_ORDER[orderStatus] ?? -1 : -1;
  const isFailed = order ? currentStep === -1 : false;
  const isPolling = order ? !TERMINAL_STATUSES.has(orderStatus) : false;

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-8 text-center sm:mb-10">
          <h1 className="font-display mb-2 text-3xl font-bold sm:text-4xl">
            តាមដានការបញ្ជាទិញ
          </h1>

          <p className="text-sm text-pink-500 sm:text-base">
            បញ្ចូលលេខបញ្ជាទិញ
          </p>
        </div>

        <form onSubmit={lookup} className="card mb-8 p-5 sm:p-6">
          <label className="label">លេខបញ្ជាទិញ</label>

          <div className="flex gap-3">
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              placeholder="RT-XXXXXXXXXX"
              className="input font-mono text-lg uppercase"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="btn-primary shrink-0"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              ) : (
                <>
                  <Search className="h-4 w-4" strokeWidth={2.5} />
                  ស្វែងរក
                </>
              )}
            </button>
          </div>

          {error && (
            <p className="mt-3 flex items-center gap-2 text-sm text-red-500">
              <XCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
              {error}
            </p>
          )}
        </form>

        {order && meta && (
          <div className="card fade-up overflow-hidden">
            <div className="border-b border-pink-200 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="mb-1 text-[10px] uppercase tracking-widest text-pink-500">
                    Order
                  </p>

                  <p className="break-all font-mono text-lg font-bold sm:text-xl">
                    {order.orderNumber}
                  </p>
                </div>

                <div
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta.color}`}
                >
                  {meta.label}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={copyOrderNumber}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink-200 bg-white px-4 py-3 text-sm font-bold text-pink-600 transition hover:bg-pink-50 active:scale-[0.99]"
                >
                  {copiedOrder ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copiedOrder ? "Copied" : "Copy Order"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void loadOrderByNumber(order.orderNumber, { silent: true })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-100 px-4 py-3 text-sm font-bold text-pink-700 transition hover:bg-pink-200 active:scale-[0.99]"
                >
                  <Search className="h-4 w-4" />
                  Refresh
                </button>
              </div>

              {isPolling && (
                <div className="mt-3 flex items-center gap-2 text-xs text-pink-500">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                  </span>
                  Auto-updating every 10 seconds
                </div>
              )}
            </div>

            {!isFailed && (
              <div className="border-b border-pink-200 px-5 py-6 sm:px-6">
                <div className="flex items-center justify-between">
                  {TIMELINE_STEPS.map((step, i) => {
                    const isReached = currentStep >= i;
                    const isCurrent = currentStep === i;

                    return (
                      <div key={step.key} className="flex flex-1 items-center">
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-700 sm:h-12 sm:w-12 ${
                              isReached
                                ? "border-green-400 bg-green-400/20 text-green-600"
                                : "border-pink-200 bg-white text-pink-500"
                            }`}
                          >
                            {isReached ? (
                              <CheckCircle2
                                className="h-5 w-5 sm:h-6 sm:w-6"
                                strokeWidth={2.5}
                              />
                            ) : (
                              <step.Icon
                                className="h-5 w-5 sm:h-6 sm:w-6"
                                strokeWidth={2}
                              />
                            )}

                            {isCurrent && (
                              <span className="absolute inset-0 animate-ping rounded-full border-2 border-green-400 opacity-30" />
                            )}
                          </div>

                          <span
                            className={`text-center text-[10px] font-medium sm:text-xs ${
                              isReached ? "text-green-600" : "text-pink-500"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>

                        {i < TIMELINE_STEPS.length - 1 && (
                          <div className="mx-2 flex-1 sm:mx-3">
                            <div className="bg-fox-border relative h-1 overflow-hidden rounded-full">
                              <div
                                className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-1000 ease-out ${
                                  currentStep > i ? "w-full" : "w-0"
                                }`}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isFailed && (
              <div className="border-b border-pink-200 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-red-400/60 bg-red-400/10 text-red-500">
                    <XCircle className="h-5 w-5" strokeWidth={2.5} />
                  </div>

                  <div>
                    <p className="font-semibold text-red-500">{meta.label}</p>
                    <p className="text-sm text-pink-500">{meta.desc}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 p-5 text-sm sm:p-6">
              <div className="flex justify-between gap-4">
                <span className="text-pink-500">Game</span>
                <span className="text-right font-medium">{order.gameName}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-pink-500">កញ្ចប់</span>
                <span className="text-right font-medium">
                  {order.productName}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-pink-500">Player ID</span>
                <span className="break-all text-right font-mono">
                  {order.playerUidMasked || "Private"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-pink-500">ការទូទាត់</span>
                <span className="text-right font-medium">
                  {String(order.paymentMethod || "KHQR").replace("_", " ")}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-pink-500">តម្លៃ</span>
                <span className="font-bold text-pink-600">
                  ${Number(order.amountUsd).toFixed(2)}
                </span>
              </div>

              <div className="space-y-3 border-t border-pink-200 pt-3">
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-pink-500">បានបង្កើត</span>
                  <span className="text-right">
                    {new Date(order.createdAt).toLocaleString()}
                  </span>
                </div>

                {order.paidAt && (
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-pink-500">បានទូទាត់</span>
                    <span className="text-right">
                      {new Date(order.paidAt).toLocaleString()}
                    </span>
                  </div>
                )}

                {order.deliveredAt && (
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-pink-500">Delivered</span>
                    <span className="text-right text-green-600">
                      {new Date(order.deliveredAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {orderStatus === "FAILED" && (
              <div className="mx-5 mb-5 rounded-lg border border-red-300 bg-red-100 p-4 text-sm text-red-500 sm:mx-6 sm:mb-6">
                មានអ្វីមិនប្រក្រតី! សូមទាក់ទងទៅ{" "}
                <strong>@thephal</strong> តាម Telegram ជាមួយលេខបញ្ជាទិញ។
              </div>
            )}

            {orderStatus === "DELIVERED" && (
              <div className="mx-5 mb-5 space-y-3 sm:mx-6 sm:mb-6">
                <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-100 p-4 text-sm text-green-600">
                  <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={2} />
                  Diamond បានដឹកជញ្ជូនជោគជ័យ!
                </div>

                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(
                    typeof window !== "undefined" ? window.location.href : ""
                  )}&text=${encodeURIComponent(
                    `⚡ Just topped up ${order.productName} for ${order.gameName} on DYTOPUP! Fast & easy 🔥`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#229ED9]/40 bg-[#229ED9]/10 py-3 text-sm font-medium text-[#229ED9] transition-colors hover:bg-[#229ED9]/20"
                >
                  <Send className="h-4 w-4" strokeWidth={2} />
                  ចែករំលែកទៅ Telegram
                </a>
              </div>
            )}

          </div>
        )}
      </main>
    </>
  );
}