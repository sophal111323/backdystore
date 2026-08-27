"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCurrency } from "@/lib/currency";
import {
  QrCode,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Smartphone,
  Loader2,
  AlertCircle,
  Download,
} from "lucide-react";

interface OrderPayment {
  orderNumber: string;
  status: string;
  gameName: string;
  gameSlug: string;
  productName: string;
  playerUid: string;
  serverId: string | null;
  amountUsd: number;
  amountKhr: number | null;
  paymentMethod: string;
  paymentRef: string | null;
  paymentUrl: string | null;
  qrString: string | null;
  paymentExpiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
}

const TERMINAL   = new Set(["DELIVERED", "FAILED", "REFUNDED", "CANCELLED"]);
const PAID_STATES = new Set(["PAID", "PROCESSING", "DELIVERED"]);

function qrImageUrl(payload: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=M&margin=2&data=${encodeURIComponent(payload)}`;
}

// ── Canvas helpers ───────────────────────────────────────────────────────────
function canvasRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r,  y + h);
  ctx.quadraticCurveTo(x,     y + h, x,     y + h - r);
  ctx.lineTo(x,      y + r);
  ctx.quadraticCurveTo(x,     y,     x + r, y);
  ctx.closePath();
}

function canvasCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

// ── Build framed KHQR PNG on a canvas and return a Blob ─────────────────────
async function buildKhqrBlob(
  qrString: string,
  amountUsd: number,
  storeName: string
): Promise<Blob> {
  const SCALE     = 2;           // retina
  const W         = 480;
  const HEADER_H  = 104;
  const PAD       = 36;
  const QR_SIZE   = 340;
  const NOTCH_R   = 22;

  // Row positions
  const STORE_Y   = HEADER_H + 48;
  const AMOUNT_Y  = HEADER_H + 120;
  const SEP_Y     = HEADER_H + 156;
  const QR_Y      = SEP_Y + 38;
  const LABEL_Y   = QR_Y + QR_SIZE + 50;
  const H         = LABEL_Y + 44;

  // Load QR image — use window.Image() to avoid TypeScript error
  const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("QR load failed"));
    img.src = qrImageUrl(qrString, QR_SIZE * SCALE);
  });

  const canvas  = document.createElement("canvas");
  canvas.width  = W  * SCALE;
  canvas.height = H  * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  // ── White card ──────────────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // ── Red header ──────────────────────────────────────────────────────────
  ctx.fillStyle = "#C8302A";
  ctx.fillRect(0, 0, W, HEADER_H);

  // "KH" text
  ctx.fillStyle = "#ffffff";
  ctx.font      = "bold 56px 'Arial Black', Impact, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  const MID_X = W / 2;
  const MID_Y = HEADER_H / 2 + 2;

  // Draw K
  ctx.fillText("K", MID_X - 76, MID_Y);
  // Draw H
  ctx.fillText("H", MID_X - 24, MID_Y);

  // ── Mini QR icon ───────────────────────────────────────────────────────
  const IX = MID_X + 10;
  const IY = MID_Y - 22;
  const IS = 44;
  const IR = 6;

  // White rounded square background
  ctx.fillStyle = "#ffffff";
  canvasRoundRect(ctx, IX, IY, IS, IS, IR);
  ctx.fill();

  ctx.fillStyle = "#C8302A";
  // Top-left finder pattern
  ctx.fillRect(IX + 5,  IY + 5,  16, 16);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(IX + 8,  IY + 8,  10, 10);
  ctx.fillStyle = "#C8302A";
  ctx.fillRect(IX + 11, IY + 11, 4,  4);
  // Top-right dot
  ctx.fillRect(IX + 26, IY + 5,  8,  8);
  // Bottom-left dot
  ctx.fillRect(IX + 5,  IY + 26, 8,  8);
  // Scattered data modules
  ctx.fillRect(IX + 26, IY + 16, 5, 5);
  ctx.fillRect(IX + 16, IY + 26, 5, 5);
  ctx.fillRect(IX + 26, IY + 26, 5, 13);
  ctx.fillRect(IX + 34, IY + 26, 5, 5);

  // "R" text
  ctx.fillStyle    = "#ffffff";
  ctx.font         = "bold 56px 'Arial Black', Impact, Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("R", MID_X + 76, MID_Y);

  // ── Store name ─────────────────────────────────────────────────────────
  ctx.fillStyle    = "#9ca3af";
  ctx.font         = "400 22px Arial, sans-serif";
  ctx.textAlign    = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(storeName, PAD, STORE_Y);

  // ── Amount ─────────────────────────────────────────────────────────────
  ctx.fillStyle = "#111827";
  ctx.font      = "bold 68px Arial, sans-serif";
  const amtStr = amountUsd.toFixed(2);
  const amtW   = ctx.measureText(amtStr).width;
  ctx.fillText(amtStr, PAD, AMOUNT_Y);

  ctx.fillStyle = "#6b7280";
  ctx.font      = "600 26px Arial, sans-serif";
  ctx.fillText("USD", PAD + amtW + 10, AMOUNT_Y - 6);

  // ── Dashed separator ───────────────────────────────────────────────────
  // Notch circles
  ctx.fillStyle   = "#f9fafb";
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth   = 1.5;

  canvasCircle(ctx, -NOTCH_R / 2, SEP_Y, NOTCH_R);
  ctx.fill(); ctx.stroke();

  canvasCircle(ctx, W + NOTCH_R / 2, SEP_Y, NOTCH_R);
  ctx.fill(); ctx.stroke();

  // Dashed line
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(NOTCH_R + 2, SEP_Y);
  ctx.lineTo(W - NOTCH_R - 2, SEP_Y);
  ctx.stroke();
  ctx.restore();

  // ── QR image ───────────────────────────────────────────────────────────
  const qrX = (W - QR_SIZE) / 2;
  ctx.drawImage(qrImg, qrX, QR_Y, QR_SIZE, QR_SIZE);

  // Dollar icon overlay (circle + $)
  const CX = W / 2;
  const CY = QR_Y + QR_SIZE / 2;
  const CR = 28;
  ctx.fillStyle = "#1f2937";
  canvasCircle(ctx, CX, CY, CR);
  ctx.fill();
  ctx.fillStyle    = "#ffffff";
  ctx.font         = "bold 30px Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", CX, CY + 1);

  // ── "Scan to Pay" ──────────────────────────────────────────────────────
  ctx.fillStyle    = "#111827";
  ctx.font         = "bold 26px Arial, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Scan to Pay", W / 2, LABEL_Y);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("toBlob failed"));
    }, "image/png");
  });
}

// ── KHQR Frame (display only) ────────────────────────────────────────────────
function KHQRFrame({
  qrString,
  amountUsd,
  storeName,
  remainingMs,
}: {
  qrString: string | null;
  amountUsd: number;
  storeName?: string;
  remainingMs: number | null;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!qrString || downloading) return;
    setDownloading(true);
    try {
      const blob = await buildKhqrBlob(
        qrString,
        amountUsd,
        storeName ?? "DyTopup"
      );
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href     = url;
      link.download = `KHQR-${amountUsd.toFixed(2)}USD.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open raw QR in new tab
      window.open(qrImageUrl(qrString, 400), "_blank");
    } finally {
      setDownloading(false);
    }
  };

  const mins  = remainingMs !== null ? String(Math.floor(remainingMs / 60000)).padStart(2, "0") : "--";
  const secs  = remainingMs !== null ? String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0") : "--";
  const isLow = remainingMs !== null && remainingMs < 60000;

  return (
    <div
      className="mx-auto overflow-hidden"
      style={{
        width: 320,
        borderRadius: 20,
        boxShadow: "0 8px 32px rgba(0,0,0,0.13)",
        border: "1px solid #e5e7eb",
        background: "#fff",
      }}
    >
      {/* ── Red KHQR header ── */}
      <div style={{ background: "#C8302A", padding: "18px 0 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="130" height="38" viewBox="0 0 130 38" fill="none">
          <text x="0"  y="32" fontFamily="'Arial Black','Impact',sans-serif" fontWeight="900" fontSize="32" fill="white">K</text>
          <text x="22" y="32" fontFamily="'Arial Black','Impact',sans-serif" fontWeight="900" fontSize="32" fill="white">H</text>
          {/* Mini QR icon */}
          <rect x="50" y="4" width="26" height="26" rx="4" fill="white"/>
          <rect x="54" y="8"  width="8"  height="8"  rx="1.5" fill="#C8302A"/>
          <rect x="64" y="8"  width="4"  height="4"  rx="1"   fill="#C8302A"/>
          <rect x="54" y="18" width="4"  height="8"  rx="1"   fill="#C8302A"/>
          <rect x="62" y="16" width="4"  height="4"  rx="1"   fill="#C8302A"/>
          <rect x="68" y="18" width="5"  height="8"  rx="1"   fill="#C8302A"/>
          <text x="80" y="32" fontFamily="'Arial Black','Impact',sans-serif" fontWeight="900" fontSize="32" fill="white">R</text>
        </svg>
      </div>

      {/* ── White body ── */}
      <div style={{ background: "#fff", padding: "20px 22px 26px" }}>

        {/* Store name */}
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "#9ca3af", fontWeight: 400 }}>
          {storeName ?? "DyTopup"}
        </p>

        {/* Amount */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 42, fontWeight: 800, color: "#111827", lineHeight: 1, letterSpacing: "-1px" }}>
            {amountUsd.toFixed(2)}
          </span>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#6b7280" }}>USD</span>
        </div>

        {/* Dashed separator with notches */}
        <div style={{ position: "relative", margin: "0 -22px 20px" }}>
          <div style={{
            position: "absolute", left: -13, top: "50%", transform: "translateY(-50%)",
            width: 26, height: 26, borderRadius: "50%",
            background: "#f9fafb", border: "1px solid #e5e7eb", zIndex: 1,
          }} />
          <div style={{
            position: "absolute", right: -13, top: "50%", transform: "translateY(-50%)",
            width: 26, height: 26, borderRadius: "50%",
            background: "#f9fafb", border: "1px solid #e5e7eb", zIndex: 1,
          }} />
          <div style={{ borderTop: "2px dashed #d1d5db", margin: "0 6px" }} />
        </div>

        {/* QR code */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {qrString ? (
            <Image
              src={qrImageUrl(qrString, 230)}
              alt="KHQR code"
              width={230}
              height={230}
              style={{ display: "block", marginBottom: 16 }}
            />
          ) : (
            <div style={{
              width: 230, height: 230, marginBottom: 16,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "#f9fafb", borderRadius: 8, border: "1.5px dashed #d1d5db",
            }}>
              <QrCode style={{ width: 48, height: 48, color: "#d1d5db", marginBottom: 8 }} />
              <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", padding: "0 16px", margin: 0 }}>
                Simulation Mode — no live QR
              </p>
            </div>
          )}

          <p style={{ margin: "0 0 6px",  fontSize: 15, fontWeight: 700, color: "#111827" }}>Scan to Pay</p>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#9ca3af" }}>or</p>

          <button
            onClick={handleDownload}
            disabled={!qrString || downloading}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "none", border: "none",
              cursor: qrString && !downloading ? "pointer" : "not-allowed",
              color: "#17a2c5", fontSize: 15, fontWeight: 700, padding: 0,
              opacity: qrString && !downloading ? 1 : 0.45, marginBottom: 10,
            }}
          >
            {downloading
              ? <Loader2 style={{ width: 22, height: 22, animation: "spin 1s linear infinite" }} />
              : <Download style={{ width: 22, height: 22 }} />
            }
            {downloading ? "Preparing..." : "Download QR"}
          </button>

          <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", textAlign: "center", lineHeight: 1.6 }}>
            and upload to Mobile Banking app<br />supporting KHQR
          </p>

          {/* Timer */}
          {remainingMs !== null && (
            <div style={{
              marginTop: 18, borderTop: "1px solid #f3f4f6", paddingTop: 14,
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Clock style={{ width: 14, height: 14, color: "#9ca3af" }} />
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                Expires in{" "}
                <span style={{ fontWeight: 700, color: isLow ? "#ef4444" : "#374151" }}>
                  {mins}:{secs}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function CheckoutClient() {
  const params = useParams<{ orderNumber: string }>();
  const { format } = useCurrency();

  const orderNumber = (params?.orderNumber || "").toUpperCase();

  const [order,       setOrder]       = useState<OrderPayment | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [copied,      setCopied]      = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [simulating,  setSimulating]  = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Order not found");
      }
      const data: OrderPayment = await res.json();
      setOrder(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
      return null;
    }
  }, [orderNumber]);

  const syncPaymentThenFetchOrder = useCallback(async () => {
    try {
      await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/sync-payment`, {
        method: "POST",
        cache: "no-store",
      });
    } catch {
      // Webhook is still the primary payment path; sync is a safe fallback.
    }

    return fetchOrder();
  }, [orderNumber, fetchOrder]);

  useEffect(() => {
    setLoading(true);
    fetchOrder().finally(() => setLoading(false));
  }, [fetchOrder]);

  // Polling — restart only when status changes to avoid infinite re-render.
  // Extract primitive values so exhaustive-deps is satisfied without
  // including the full order object (which changes reference on every fetch).
  const orderStatus = order?.status;
  const orderExists = order !== null;
  useEffect(() => {
    if (!orderExists || !orderStatus) return;
    if (TERMINAL.has(orderStatus) || PAID_STATES.has(orderStatus)) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(() => { syncPaymentThenFetchOrder(); }, 5000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [orderExists, orderStatus, syncPaymentThenFetchOrder]);

  // Countdown — uses paymentExpiresAt from API; falls back to createdAt + 5 min.
  const expiresAt = order?.paymentExpiresAt;
  const createdAt = order?.createdAt;
  useEffect(() => {
    if (!createdAt) { setRemainingMs(null); return; }
    const expiry = expiresAt
      ? new Date(expiresAt).getTime()
      : new Date(createdAt).getTime() + 5 * 60 * 1000;
    const tick = () => { const ms = expiry - Date.now(); setRemainingMs(ms > 0 ? ms : 0); };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, createdAt]);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard may be unavailable */ }
  }

  // Simulation only works in dev when order has a SIM- paymentRef.
  const canSimulate =
    process.env.NEXT_PUBLIC_ALLOW_SIMULATION === "true" &&
    !!order?.paymentRef &&
    order.paymentRef.startsWith("SIM-");

  async function handleSimulate() {
    if (!order || simulating || !canSimulate) return;
    setSimulating(true);
    try {
      await fetch(
        `/api/payment/simulate?order=${encodeURIComponent(order.orderNumber)}&ref=${encodeURIComponent(order.paymentRef ?? "")}`,
        { cache: "no-store" }
      );
      await fetchOrder();
    } finally { setSimulating(false); }
  }

  const isExpired = remainingMs !== null && remainingMs <= 0 && !PAID_STATES.has(order?.status ?? "");
  const isPaid    = order ? PAID_STATES.has(order.status) : false;

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12 sm:px-6">

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-pink-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            កំពុងដំណើរការ...
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="rounded-xl border border-red-400/40 bg-red-400/10 p-6 text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-300">{error}</p>
            <Link href="/" className="inline-block mt-4 btn-primary">ត្រឡប់ទៅកាន់ទំព័រដើម</Link>
          </div>
        )}

        {/* ── Order loaded ── */}
        {!loading && order && (
          <>
            {/* Paid */}
            {isPaid && (
              <div className="rounded-2xl border border-green-400/40 bg-gradient-to-br from-green-500/10 to-emerald-500/5 p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 mb-4">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <h1 className="font-display text-2xl font-bold mb-2">ការទូទាត់បានជោគជ័យ!</h1>
                <p className="text-pink-500 text-sm mb-1">
                  Order <span className="font-mono text-pink-800">{order.orderNumber}</span>
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
                  <Link href="/" className="inline-flex items-center justify-center rounded-xl border border-pink-400 px-6 py-3 text-sm font-semibold text-pink-600">
                    Back to Home
                  </Link>
                  <Link href={`/order?number=${order.orderNumber}`} className="inline-flex items-center justify-center rounded-xl bg-pink-600 px-6 py-3 text-sm font-semibold text-white">
                    Track Order
                  </Link>
                </div>
              </div>
            )}

            {/* Expired */}
            {!isPaid && isExpired && (
              <div className="rounded-2xl border border-red-400/40 bg-red-400/10 p-8 text-center">
                <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                <h1 className="font-display text-xl font-bold mb-2">ការទូទាត់បានផុតកំណត់</h1>
                <p className="text-pink-500 text-sm mb-4">QR-Code នេះត្រូវបានផុតកំណត់</p>
                <Link href={`/games/${order.gameSlug}`} className="btn-primary">បញ្ជាទិញឡើងវិញ</Link>
              </div>
            )}

            {/* Active payment */}
            {!isPaid && !isExpired && (
              <div className="space-y-6">
                {/* KHQR frame — storeName driven by order number prefix */}
                <KHQRFrame
                  qrString={order.qrString}
                  amountUsd={order.amountUsd}
                  storeName="JASMIN TOP UP"
                  remainingMs={remainingMs}
                />

                {/* Live polling status */}
                <div className="rounded-xl border border-pink-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-pink-600" />
                    <span className="text-pink-500">កំពុងរង់ចាំការទូទាត់...</span>
                  </div>
                </div>

                {/* Order summary */}
                <div className="rounded-xl border border-pink-200 bg-white p-4">
                  <div className="text-[10px] uppercase tracking-widest text-pink-500 mb-3">លម្អិតការបញ្ជាទិញ</div>
                  <div className="space-y-2 text-sm">
                    <Row label="លេខបញ្ជាទិញ">
                      <button
                        type="button"
                        onClick={() => copy(order.orderNumber, "order")}
                        className="inline-flex items-center gap-1.5 font-mono hover:text-pink-600"
                      >
                        {order.orderNumber}
                        {copied === "order"
                          ? <Check className="h-3 w-3 text-green-600" />
                          : <Copy  className="h-3 w-3 text-pink-500" />}
                      </button>
                    </Row>
                    <Row label="Game">{order.gameName}</Row>
                    <Row label="កញ្ចប់">{order.productName}</Row>
                    <Row label="Player ID">
                      <span className="font-mono">{order.playerUid}</span>
                      {order.serverId && (
                        <span className="text-pink-500"> ({order.serverId})</span>
                      )}
                    </Row>
                  </div>
                </div>

                {/* Payment instructions */}
                <div className="rounded-xl border border-pink-200/60 bg-pink-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <Smartphone className="h-5 w-5 text-pink-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-pink-500 space-y-1">
                      <p className="font-semibold text-pink-800">របៀបទូទាត់ប្រាក់:</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-xs">
                        <li>បើកកម្មវិធីធនាគាររបស់លោកអ្នក (ABA, ACLEDA, Wing...)</li>
                        <li>ចុច &quot;Scan KHQR&quot; ហើយស្កែន QR-CODEខាងលើ</li>
                        <li>បញ្ជាក់ចំនួនទឹកប្រាក់ហើយទូទាត់</li>
                        <li>ហើយការបញ្ជាទិញនឹងជោគជ័ដោយស្វ័យប្រវត្តិនៅពេលបង់ប្រាក់រួចរាល់</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Dev-only simulate button — hidden in production */}
                {canSimulate && (
                  <div className="rounded-xl border border-yellow-400/40 bg-yellow-50/60 p-4 text-center">
                    <p className="text-xs text-yellow-700 mb-2 font-semibold">
                      ⚠️ DEV SIMULATION MODE — blocked in production
                    </p>
                    <button
                      type="button"
                      onClick={handleSimulate}
                      disabled={simulating}
                      className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {simulating && <Loader2 className="h-4 w-4 animate-spin" />}
                      {simulating ? "Processing..." : "Simulate Payment"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

// ── Shared row component ─────────────────────────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-pink-500 text-xs">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}