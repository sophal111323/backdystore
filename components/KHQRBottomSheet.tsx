"use client";

/* eslint-disable @next/next/no-img-element */

import QRCode from "qrcode";
import {
  Download,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Clock3,
  Copy,
  ExternalLink,
  Check,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type OrderPayment = {
  orderNumber: string;
  status: string;
  amountUsd: number;
  qrString: string | null;

  expiresAt?: string | null;
  paymentExpiresAt?: string | null;
  canPay?: boolean;
  isExpired?: boolean;
};

type KHQRBottomSheetProps = {
  order: OrderPayment;
  onClose: () => void;
  onRetry?: () => void;
};

function isPaid(status: string) {
  return ["PAID", "PROCESSING", "DELIVERED"].includes(status);
}

function formatExpireClock(expiresAt?: string | null) {
  if (!expiresAt) return null;

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function KHQRBottomSheet({
  order,
  onClose,
}: KHQRBottomSheetProps) {
  const [currentOrder, setCurrentOrder] = useState<OrderPayment>(order);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [copiedOrder, setCopiedOrder] = useState(false);

  const paymentPollBusyRef = useRef(false);
  const paymentPollStartedAtRef = useRef(Date.now());

  const orderPageUrl = `/order?orderNumber=${encodeURIComponent(
    currentOrder.orderNumber
  )}`;

  const expireValue =
    currentOrder.expiresAt ?? currentOrder.paymentExpiresAt ?? null;

  const expiresMs = useMemo(() => {
    if (!expireValue) return null;

    const value = new Date(expireValue).getTime();
    return Number.isNaN(value) ? null : value;
  }, [expireValue]);

  const expired =
    currentOrder.isExpired === true ||
    (!isPaid(currentOrder.status) &&
      expiresMs !== null &&
      now >= expiresMs);

  async function copyOrderNumber() {
    try {
      await navigator.clipboard.writeText(currentOrder.orderNumber);
    } catch {
      const input = document.createElement("input");
      input.value = currentOrder.orderNumber;
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

  // ✅ Generate QR locally
  useEffect(() => {
    async function generateQR() {
      if (!currentOrder.qrString || expired) {
        setQrDataUrl(null);
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(currentOrder.qrString, {
          width: 260,
          margin: 2,
          errorCorrectionLevel: "M",
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });

        setQrDataUrl(dataUrl);
      } catch {
        setQrDataUrl(null);
      }
    }

    generateQR();
  }, [currentOrder.qrString, expired]);

  // ✅ Lock background scroll
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, []);

  // ✅ Close with ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // ✅ Local clock for expire check
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // ✅ Safe payment polling for the bottom-sheet flow
  useEffect(() => {
    if (isPaid(currentOrder.status)) return;

    async function pollPaymentStatus() {
      if (paymentPollBusyRef.current) return;
      paymentPollBusyRef.current = true;

      try {
        await fetch(
          `/api/orders/${encodeURIComponent(
            currentOrder.orderNumber
          )}/sync-payment`,
          { method: "POST", cache: "no-store" }
        ).catch(() => null);

        const res = await fetch(
          `/api/orders/${encodeURIComponent(currentOrder.orderNumber)}`,
          { cache: "no-store" }
        );

        if (!res.ok) return;

        const data = await res.json();
        setCurrentOrder(data);
      } catch {
        // Webhook remains the primary payment path; polling is a safe fallback.
      } finally {
        paymentPollBusyRef.current = false;
      }
    }

    void pollPaymentStatus();

    const timer = setInterval(() => {
      const pollingTooLong =
        Date.now() - paymentPollStartedAtRef.current > 10 * 60 * 1000;

      if (pollingTooLong) {
        clearInterval(timer);
        return;
      }

      void pollPaymentStatus();
    }, 10000);

    return () => clearInterval(timer);
  }, [currentOrder.orderNumber, currentOrder.status]);

  async function downloadKHQRCard() {
    if (!currentOrder.qrString || expired) return;

    const qrLarge = await QRCode.toDataURL(currentOrder.qrString, {
      width: 620,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    const img = new window.Image();
    img.src = qrLarge;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 1250;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#fdf2f8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(80, 60, 740, 1130, 34);
      ctx.fill();

      ctx.fillStyle = "#ef2b2d";
      ctx.beginPath();
      ctx.roundRect(80, 60, 740, 170, 34);
      ctx.fill();
      ctx.fillRect(80, 150, 740, 80);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 54px Arial";
      ctx.textAlign = "center";
      ctx.fillText("KHQR", 450, 170);

      ctx.fillStyle = "#6b7280";
      ctx.textAlign = "left";
      ctx.font = "500 28px Arial";
      ctx.fillText("JASMIN TOP UP", 145, 320);

      ctx.fillStyle = "#111827";
      ctx.font = "bold 58px Arial";
      ctx.fillText(Number(currentOrder.amountUsd).toFixed(2), 145, 395);

      ctx.fillStyle = "#6b7280";
      ctx.font = "500 28px Arial";
      ctx.fillText("USD", 300, 395);

      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 14]);
      ctx.beginPath();
      ctx.moveTo(130, 450);
      ctx.lineTo(770, 450);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(150, 510, 600, 600);
      ctx.drawImage(img, 165, 525, 570, 570);

      ctx.fillStyle = "#111827";
      ctx.textAlign = "center";
      ctx.font = "bold 34px Arial";
      ctx.fillText("Scan to Pay", 450, 1150);

      ctx.fillStyle = "#6b7280";
      ctx.font = "24px Arial";
      ctx.fillText(`Order: ${currentOrder.orderNumber}`, 450, 1190);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `KHQR-${currentOrder.orderNumber}.png`;
      a.click();
    };
  }

  async function handleRefreshSameOrder() {
    try {
      setRefreshing(true);

      const res = await fetch(
        `/api/orders/${encodeURIComponent(
          currentOrder.orderNumber
        )}/refresh-payment`,
        {
          method: "POST",
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create new KHQR");
      }

      setCurrentOrder(data);
      setNow(Date.now());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create new KHQR");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-[30px] bg-white shadow-2xl animate-slide-up"
      >
        <div className="bg-red-600 px-6 py-5 text-white">
          <h2 className="text-center text-3xl font-black tracking-wide">
            KHQR
          </h2>
        </div>

        {isPaid(currentOrder.status) ? (
          <div key="paid" className="animate-slide-up px-7 py-10 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>

            <h3 className="text-2xl font-black text-gray-900">
              ការទូទាត់បានជោគជ័យ!
            </h3>

            <div className="mt-5 rounded-2xl border border-pink-100 bg-pink-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-pink-500">
                Order Number
              </p>

              <p className="mt-1 break-all font-mono text-base font-black text-gray-900">
                {currentOrder.orderNumber}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={copyOrderNumber}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-pink-200 bg-white px-4 py-3 text-sm font-extrabold text-pink-600 shadow-sm transition hover:bg-pink-50 active:scale-[0.99]"
              >
                {copiedOrder ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}

                {copiedOrder ? "Copied" : "Copy Order"}
              </button>

              <a
                href={orderPageUrl}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-pink-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-pink-200 transition hover:scale-[1.01] active:scale-[0.99]"
              >
                Go to Order
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        ) : expired ? (
          <div key="expired" className="animate-slide-up px-7 py-10 text-center">
            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-pink-50 ring-8 ring-pink-100/70">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
                <Clock3 className="h-8 w-8 text-pink-600" />
              </div>
            </div>

            <h3 className="text-3xl font-black text-gray-900">QR Expired</h3>

            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-gray-500">
              QR នេះបានផុតកំណត់ហើយ។ សូមបង្កើត KHQR ថ្មី
              ដើម្បីទូទាត់លើ Order ដដែល។
            </p>

            <div className="mx-auto mt-6 max-w-xs rounded-2xl border border-pink-100 bg-pink-50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold text-pink-600">Amount</span>
                <span className="font-black text-pink-800">
                  {Number(currentOrder.amountUsd).toFixed(2)} USD
                </span>
              </div>

              {formatExpireClock(expireValue) && (
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="font-bold text-pink-600">Expired</span>
                  <span className="font-black text-pink-800">
                    {formatExpireClock(expireValue)}
                  </span>
                </div>
              )}

              <div className="mt-3 border-t border-pink-100 pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-pink-500">
                  Order Number
                </p>

                <p className="mt-1 break-all font-mono text-sm font-black text-gray-900">
                  {currentOrder.orderNumber}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={copyOrderNumber}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-pink-200 bg-white px-4 py-3 text-sm font-extrabold text-pink-600 shadow-sm transition hover:bg-pink-50 active:scale-[0.99]"
              >
                {copiedOrder ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}

                {copiedOrder ? "Copied" : "Copy Order"}
              </button>

              <a
                href={orderPageUrl}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-pink-100 px-4 py-3 text-sm font-extrabold text-pink-700 transition hover:bg-pink-200 active:scale-[0.99]"
              >
                Go to Order
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <button
              type="button"
              onClick={handleRefreshSameOrder}
              disabled={refreshing}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-pink-500 px-5 py-3.5 text-base font-extrabold text-white shadow-lg shadow-pink-200 transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
            >
              {refreshing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}

              {refreshing ? "Creating New KHQR..." : "Create New KHQR"}
            </button>
          </div>
        ) : (
          <div key="active" className="animate-slide-up px-7 py-6">
            <p className="text-sm font-medium text-gray-500">JASMIN TOP UP</p>

            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black text-gray-900">
                {Number(currentOrder.amountUsd).toFixed(2)}
              </span>

              <span className="pb-1 text-sm font-semibold text-gray-600">
                USD
              </span>
            </div>

            <div className="my-5 border-t-2 border-dashed border-gray-300" />

            <div className="flex flex-col items-center text-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="KHQR Code"
                  className="h-[220px] w-[220px]"
                />
              ) : (
                <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-dashed text-gray-400">
                  No QR available
                </div>
              )}

              <p className="mt-3 text-lg font-bold text-gray-900">
                Scan to Pay
</p>
              <button
                type="button"
                onClick={downloadKHQRCard}
                disabled={!currentOrder.qrString}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold text-cyan-500 disabled:opacity-40"
              >
                <Download className="h-5 w-5" />
                Download KHQR
              </button>

              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                កំពុងរង់ចាំការទូទាត់...
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
