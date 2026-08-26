import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { applyRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getIp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVOICEABLE_STATUSES = new Set(["PAID", "PROCESSING", "DELIVERED"]);

const BRAND = {
  primary:     "#E91E8C",
  primaryDark: "#C2185B",
  light:       "#FF6EB4",
  soft:        "#FFE4F0",
  border:      "#FFB3D1",
  ink:         "#3D0020",
  muted:       "#9C4070",
  white:       "#FFFFFF",
  success:     "#16a34a",
};

const EN = {
  invoice:     "INVOICE",
  billedTo:    "BILLED TO",
  orderDetails:"ORDER DETAILS",
  orderNum:    "Order Number",
  orderDate:   "Order Date",
  payment:     "Payment Method",
  reference:   "Reference",
  paidOn:      "Paid On",
  playerUid:   "Player UID",
  server:      "Server",
  description: "Description",
  qty:         "Qty",
  unit:        "Unit Price",
  total:       "Total",
  subtotal:    "Subtotal",
  fees:        "Fees",
  totalUsd:    "Total Amount (USD)",
  deliveredTo: "Delivered to UID",
  tagline:     "Game Top-Up · Cambodia",
  support:     "Support: @jasmintopup on Telegram",
  thankyou:    "Thank you for your purchase!",
  footerBody:  "Credits are delivered directly to your game account. If you do not receive them within 10 minutes, please contact us.",
  generated:   "This invoice was system-generated for order",
  noSig:       "No signature required",
  paid:        "PAID",
  issued:      "Date Issued",
};

// Built-in PDFKit fonts — no download needed
const KR = "Helvetica";
const KB = "Helvetica-Bold";

// ── Logo: fetch from remote URL, cache buffer in memory ──────────────────────
const LOGO_URL =
  "https://i.ibb.co/mVYkHDYL/file-000000009d3871faa1dcdb1b67a3b6f5.png";
let cachedLogo: Buffer | null = null;

async function fetchLogo(): Promise<Buffer | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const res = await fetch(LOGO_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    cachedLogo = Buffer.from(await res.arrayBuffer());
    return cachedLogo;
  } catch {
    return null;
  }
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function renderPdf(
  order: {
    orderNumber: string;
    playerUid: string;
    serverId: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    amountUsd: number;
    amountKhr: number | null;
    paymentMethod: string;
    paymentRef: string | null;
    status: string;
    createdAt: Date;
    paidAt: Date | null;
    deliveredAt: Date | null;
    game: { name: string; publisher: string; currencyName: string };
    product: { name: string; amount: number; bonus: number; priceUsd: number };
  },
  logoBuffer: Buffer | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW    = doc.page.width;   // 595
    const pageH    = doc.page.height;  // 842
    const marginX  = 50;
    const contentW = pageW - marginX * 2;

    // ── Header ──────────────────────────────────────────────────────────
    const headerH = 155;
    doc.rect(0, 0,       pageW, headerH).fill(BRAND.primary);
    doc.rect(0, 0,       pageW, 5).fill(BRAND.light);
    doc.rect(0, headerH, pageW, 5).fill(BRAND.primaryDark);

    // Logo image
    let brandX = marginX;
    if (logoBuffer) {
      doc.image(logoBuffer, marginX, 38, { width: 54, height: 54 });
      brandX = marginX + 66;
    }

    // Brand name
    doc.fillColor(BRAND.white).font(KB).fontSize(26).text("JASMIN", brandX, 48);
    const jW = doc.widthOfString("JASMIN");
    doc.fillColor("rgba(255,255,255,0.70)").fontSize(26).text("TOPUP", brandX + jW + 2, 48);
    doc.fillColor("rgba(255,255,255,0.70)").font(KR).fontSize(9).text(EN.tagline, brandX, 82);
    doc.fillColor("rgba(255,255,255,0.50)").fontSize(8).text(EN.support, brandX, 96);

    // INVOICE — right aligned
    doc.fillColor(BRAND.white).font(KB).fontSize(36)
      .text(EN.invoice, marginX, 46, { width: contentW, align: "right" });
    doc.fillColor("rgba(255,255,255,0.78)").font(KR).fontSize(9)
      .text(`No. ${order.orderNumber}`, marginX, 92, { width: contentW, align: "right" });
    doc.fillColor("rgba(255,255,255,0.55)").fontSize(8)
      .text(
        `${EN.issued}: ${fmtDate(order.paidAt ?? order.createdAt)}`,
        marginX, 106, { width: contentW, align: "right" }
      );

    // ── Billed To + Order Details ──────────────────────────────────────
    let y = headerH + 36;
    const colW = (contentW - 30) / 2;
    const rx   = marginX + colW + 30;

    doc.roundedRect(marginX - 10, y - 12, colW + 20, 122, 8).fill(BRAND.soft);
    doc.roundedRect(rx - 10,      y - 12, colW + 20, 122, 8).fill(BRAND.soft);

    // Left — Billed To
    doc.fillColor(BRAND.primary).font(KB).fontSize(8)
      .text(EN.billedTo, marginX, y, { characterSpacing: 1 });
    const customerLabel =
      order.customerEmail || order.customerPhone || `Player ${order.playerUid}`;
    doc.fillColor(BRAND.ink).font(KB).fontSize(11).text(customerLabel, marginX, y + 15);
    doc.font(KR).fontSize(9).fillColor(BRAND.muted);
    if (order.customerEmail && order.customerPhone) {
      doc.text(order.customerPhone, marginX, y + 31);
    }
    doc.text(
      `${EN.playerUid}: ${order.playerUid}`,
      marginX, y + (order.customerEmail && order.customerPhone ? 46 : 31)
    );
    if (order.serverId) {
      doc.text(
        `${EN.server}: ${order.serverId}`,
        marginX, y + (order.customerEmail && order.customerPhone ? 61 : 46)
      );
    }

    // Right — Order Details
    doc.fillColor(BRAND.primary).font(KB).fontSize(8)
      .text(EN.orderDetails, rx, y, { characterSpacing: 1 });

    const detailRows: Array<[string, string]> = [
      [EN.orderNum,  order.orderNumber],
      [EN.orderDate, fmtDateTime(order.createdAt)],
      [EN.payment,   order.paymentMethod.replace(/_/g, " ")],
    ];
    if (order.paymentRef) detailRows.push([EN.reference, order.paymentRef]);
    if (order.paidAt)     detailRows.push([EN.paidOn,    fmtDateTime(order.paidAt)]);

    let detailY = y + 15;
    detailRows.forEach(([k, v]) => {
      doc.font(KR).fontSize(9).fillColor(BRAND.muted).text(k, rx, detailY);
      doc.font(KB).fontSize(9).fillColor(BRAND.ink)
        .text(v, rx + 90, detailY, { width: colW - 90 });
      detailY += 15;
    });

    // ── Items Table ────────────────────────────────────────────────────
    y = Math.max(y + 132, detailY + 24);

    const tableH = 30;
    doc.roundedRect(marginX, y, contentW, tableH, 6).fill(BRAND.primary);

    const col = {
      desc:  marginX + 14,
      qty:   marginX + contentW - 200,
      unit:  marginX + contentW - 130,
      total: marginX + contentW - 14,
    };

    doc.fillColor(BRAND.white).font(KB).fontSize(9)
      .text(EN.description, col.desc,       y + 11, { characterSpacing: 0.5 });
    doc.text(EN.qty,   col.qty,        y + 11, { width: 40, align: "center" });
    doc.text(EN.unit,  col.unit,       y + 11, { width: 60, align: "right" });
    doc.text(EN.total, col.total - 60, y + 11, { width: 60, align: "right" });

    y += tableH;

    const rowH = 72;
    doc.roundedRect(marginX, y, contentW, rowH, 6).fill(BRAND.soft);

    const bonusText = order.product.bonus > 0 ? ` (+${order.product.bonus} bonus)` : "";

    doc.fillColor(BRAND.ink).font(KB).fontSize(11)
      .text(order.product.name, col.desc, y + 13, { width: contentW - 230 });
    doc.fillColor(BRAND.muted).font(KR).fontSize(9)
      .text(
        `${order.game.name} — ${order.product.amount}${bonusText} ${order.game.currencyName}`,
        col.desc, y + 30, { width: contentW - 230 }
      );
    doc.fillColor(BRAND.muted).fontSize(8)
      .text(`${EN.deliveredTo} ${order.playerUid}`, col.desc, y + 48, { width: contentW - 230 });

    doc.fillColor(BRAND.ink).font(KR).fontSize(10)
      .text("1", col.qty, y + 27, { width: 40, align: "center" });
    doc.text(`$${order.product.priceUsd.toFixed(2)}`, col.unit, y + 27, { width: 60, align: "right" });
    doc.font(KB).fillColor(BRAND.primary)
      .text(`$${order.amountUsd.toFixed(2)}`, col.total - 60, y + 27, { width: 60, align: "right" });

    y += rowH + 16;

    // ── Totals ─────────────────────────────────────────────────────────
    const totalsW = 250;
    const totalsX = marginX + contentW - totalsW;
    doc.roundedRect(totalsX - 10, y - 8, totalsW + 10, 100, 8).fill(BRAND.soft);

    const writeTotalsRow = (label: string, value: string, bold = false, accent = false) => {
      doc
        .fillColor(accent ? BRAND.primary : BRAND.muted)
        .font(bold ? KB : KR)
        .fontSize(accent ? 13 : 10)
        .text(label, totalsX, y, { width: totalsW / 2, align: "left" });
      doc
        .fillColor(accent ? BRAND.primaryDark : BRAND.ink)
        .font(KB)
        .fontSize(accent ? 14 : 10)
        .text(value, totalsX + totalsW / 2, y, { width: totalsW / 2, align: "right" });
      y += accent ? 26 : 18;
    };

    writeTotalsRow(EN.subtotal, `$${order.amountUsd.toFixed(2)}`);
    writeTotalsRow(EN.fees,     "$0.00");
    doc.moveTo(totalsX, y + 2).lineTo(totalsX + totalsW, y + 2)
      .strokeColor(BRAND.border).lineWidth(1).stroke();
    y += 10;
    writeTotalsRow(EN.totalUsd, `$${order.amountUsd.toFixed(2)}`, true, true);

    if (order.amountKhr) {
      doc.fillColor(BRAND.muted).font(KR).fontSize(9)
        .text(
          `~ ${Math.round(order.amountKhr).toLocaleString()} KHR`,
          totalsX, y, { width: totalsW, align: "right" }
        );
      y += 16;
    }

    // ── PAID Stamp ──────────────────────────────────────────────────────
    if (INVOICEABLE_STATUSES.has(order.status)) {
      const stampX = marginX + 40;
      const stampY = y - 55;
      doc.save();
      doc.rotate(-14, { origin: [stampX + 100, stampY + 35] });
      doc.roundedRect(stampX, stampY, 200, 70, 10)
        .strokeColor(BRAND.success).lineWidth(3).stroke();
      doc.fillColor(BRAND.success).font(KB).fontSize(30)
        .text(EN.paid, stampX, stampY + 12, { width: 200, align: "center", characterSpacing: 3 });
      doc.fontSize(8)
        .text(
          new Date(order.paidAt ?? order.createdAt).toLocaleDateString("en-GB"),
          stampX, stampY + 50, { width: 200, align: "center" }
        );
      doc.restore();
    }

    // ── Footer ──────────────────────────────────────────────────────────
    const footerY = pageH - 112;
    doc.rect(0, footerY,     pageW, 4).fill(BRAND.light);
    doc.rect(0, footerY + 4, pageW, 108).fill(BRAND.primaryDark);

    doc.fillColor(BRAND.white).font(KB).fontSize(12)
      .text(EN.thankyou, 0, footerY + 20, { width: pageW, align: "center" });
    doc.fillColor("rgba(255,255,255,0.75)").font(KR).fontSize(9)
      .text(EN.footerBody, marginX, footerY + 40, { width: contentW, align: "center" });
    doc.fillColor(BRAND.white).font(KB).fontSize(9)
      .text("Telegram: @jasmintopup", marginX, footerY + 80);
    doc.fillColor("rgba(255,255,255,0.50)").font(KR).fontSize(8)
      .text(
        `${EN.generated} ${order.orderNumber}. ${EN.noSig}.`,
        marginX, footerY + 80, { width: contentW, align: "right" }
      );

    doc.end();
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  const normalizedOrderNumber = orderNumber.trim().toUpperCase();
  const ip = getClientIp(req);

  const rl = await applyRateLimit(
    `invoice:${normalizedOrderNumber}:${ip}`,
    20,
    10 * 60 * 1000,
    ip
  );
  if (rl) return rl;

  if (!/^[A-Z0-9-]{3,40}$/.test(normalizedOrderNumber)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: normalizedOrderNumber },
    include: {
      game:    { select: { name: true, publisher: true, currencyName: true } },
      product: { select: { name: true, amount: true, bonus: true, priceUsd: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!INVOICEABLE_STATUSES.has(order.status)) {
    return NextResponse.json(
      { error: "Invoice is only available after payment is confirmed." },
      { status: 409 }
    );
  }

  // ── Auth: admin session OR ownership proof via ?uid= ─────────────────────
  //
  // This route is outside /api/admin/* so middleware does NOT protect it.
  // We allow two access modes:
  //
  //   1. Admin: valid admin_token JWT cookie → full access to any invoice.
  //   2. Customer self-service: ?uid=<playerUid> must match the order's
  //      playerUid exactly.  The UID is already shown on the order tracker
  //      page, so the customer always has it.  An attacker would need BOTH
  //      a valid orderNumber AND the correct UID — two independent unknowns.
  //
  // If neither check passes → 401.
  const admin = await getCurrentAdmin().catch(() => null);

  if (!admin) {
    const uidParam = req.nextUrl.searchParams.get("uid")?.trim() ?? "";
    if (
      !uidParam ||
      uidParam.toLowerCase() !== order.playerUid.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error:
            "Access denied. Include your Player UID as ?uid=<yourUID> " +
            "or log in as admin.",
        },
        { status: 401 }
      );
    }
  }

  const logoBuffer = await fetchLogo();
  const pdf = await renderPdf(order, logoBuffer);

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${order.orderNumber}.pdf"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "no-store",
    },
  });
}