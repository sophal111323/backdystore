import PDFDocument from "pdfkit";

export interface PaidReadyPdfOrder {
  orderNumber: string;
  playerUid: string;
  serverId?: string | null;
  amountUsd: number;
  status: string;
  ipAddress?: string | null;
  paidAt?: Date | string | null;
  createdAt?: Date | string | null;
  game?: {
    name: string;
  } | null;
  product?: {
    name: string;
    amount?: number;
    bonus?: number;
  } | null;
}

export interface PaidReadyPdfOptions {
  dateLabel: string;
  orders: PaidReadyPdfOrder[];
  totalRevenueUsd?: number;
}

const FONTS = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  mono: "Courier",
  monoBold: "Courier-Bold",
};

const COLORS = {
  brandPink: "#E91E8C",
  brandDark: "#0F172A",
  headerBg: "#1E293B",
  tableHeaderBg: "#F1F5F9",
  tableHeaderText: "#475569",
  rowEven: "#FFFFFF",
  rowOdd: "#F8FAFC",
  borderLight: "#E2E8F0",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  statusDeliveredBg: "#DCFCE7",
  statusDeliveredText: "#15803D",
  statusPaidBg: "#DBEAFE",
  statusPaidText: "#1D4ED8",
  statusProcessingBg: "#FEF3C7",
  statusProcessingText: "#B45309",
  statusDefaultBg: "#F1F5F9",
  statusDefaultText: "#475569",
};

function formatCambodiaTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleTimeString("en-GB", {
      timeZone: "Asia/Phnom_Penh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "-";
  }
}

function formatCambodiaDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleString("en-GB", {
      timeZone: "Asia/Phnom_Penh",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "-";
  }
}

function getStatusTheme(status: string) {
  const s = (status || "").toUpperCase();
  if (s === "DELIVERED") {
    return { bg: COLORS.statusDeliveredBg, text: COLORS.statusDeliveredText };
  }
  if (s === "PAID") {
    return { bg: COLORS.statusPaidBg, text: COLORS.statusPaidText };
  }
  if (s === "PROCESSING") {
    return { bg: COLORS.statusProcessingBg, text: COLORS.statusProcessingText };
  }
  return { bg: COLORS.statusDefaultBg, text: COLORS.statusDefaultText };
}

export async function generatePaidReadyPdf(options: PaidReadyPdfOptions): Promise<Buffer> {
  const { dateLabel, orders, totalRevenueUsd } = options;

  const totalCalculatedRevenue =
    totalRevenueUsd !== undefined
      ? totalRevenueUsd
      : Math.round(orders.reduce((sum, o) => sum + (o.amountUsd || 0), 0) * 100) / 100;

  return new Promise((resolve, reject) => {
    // Landscape A4: 841.89 x 595.28 pt
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 36,
      bufferPages: true,
      info: {
        Title: `Paid Ready Orders - ${dateLabel}`,
        Author: "DYTOPUP System",
        Subject: "Daily Paid Orders Report",
        Creator: "DYTOPUP Automated Reporter",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const leftX = 36;
    const contentW = 770;
    const maxY = 540;
    const rowH = 22;
    const headerH = 22;

    // Column Definitions: Total = 770
    const cols = [
      { id: "idx", label: "#", x: 36, w: 28, align: "center" as const },
      { id: "time", label: "Time (ICT)", x: 64, w: 58, align: "center" as const },
      { id: "game", label: "Game", x: 122, w: 110, align: "left" as const },
      { id: "order", label: "Order Number", x: 232, w: 112, align: "left" as const },
      { id: "uid", label: "Player UID", x: 344, w: 106, align: "left" as const },
      { id: "pkg", label: "Package", x: 450, w: 136, align: "left" as const },
      { id: "amount", label: "Amount", x: 586, w: 64, align: "right" as const },
      { id: "status", label: "Status", x: 650, w: 66, align: "center" as const },
      { id: "ip", label: "IP Address", x: 716, w: 90, align: "left" as const },
    ];

    function drawTableHeader(y: number) {
      // Header background
      doc.rect(leftX, y, contentW, headerH).fill(COLORS.tableHeaderBg);
      doc.rect(leftX, y + headerH - 1, contentW, 1).fill(COLORS.borderLight);

      doc.fillColor(COLORS.tableHeaderText).font(FONTS.bold).fontSize(8);
      for (const col of cols) {
        doc.text(col.label, col.x + 3, y + 6, {
          width: col.w - 6,
          align: col.align,
        });
      }
    }

    // ── PAGE 1 TOP BANNER ────────────────────────────────────────────────────
    const bannerY = 36;
    const bannerH = 60;

    // Background card
    doc.roundedRect(leftX, bannerY, contentW, bannerH, 6).fill(COLORS.headerBg);
    // Accent line on left
    doc.roundedRect(leftX, bannerY, 4, bannerH, 2).fill(COLORS.brandPink);

    // Brand and Report Title
    doc.fillColor(COLORS.brandPink).font(FONTS.bold).fontSize(14).text("DY", leftX + 16, bannerY + 12);
    const dyW = doc.widthOfString("DY");
    doc.fillColor("#FFFFFF").fontSize(14).text("TOPUP", leftX + 16 + dyW + 2, bannerY + 12);
    const topupW = doc.widthOfString("TOPUP");

    doc.fillColor(COLORS.textMuted).font(FONTS.regular).fontSize(13)
      .text(" ·  Paid Ready Orders Report", leftX + 16 + dyW + 2 + topupW + 4, bannerY + 12);

    doc.fillColor("#94A3B8").font(FONTS.regular).fontSize(8.5)
      .text(`Report Period: ${dateLabel} (Cambodia Time UTC+7)   •   Generated: ${formatCambodiaDateTime(new Date())}`, leftX + 16, bannerY + 36);

    // KPI Badges on the right of banner
    const kpiY = bannerY + 10;
    const kpiW = 120;
    const kpiH = 40;

    // KPI 1: Total Orders
    const kpi1X = leftX + contentW - (kpiW * 2 + 12) - 10;
    doc.roundedRect(kpi1X, kpiY, kpiW, kpiH, 4).fill("#334155");
    doc.fillColor("#94A3B8").font(FONTS.regular).fontSize(7.5)
      .text("TOTAL PAID ORDERS", kpi1X + 8, kpiY + 7);
    doc.fillColor("#FFFFFF").font(FONTS.bold).fontSize(13)
      .text(`${orders.length}`, kpi1X + 8, kpiY + 19);

    // KPI 2: Total Revenue
    const kpi2X = leftX + contentW - kpiW - 10;
    doc.roundedRect(kpi2X, kpiY, kpiW, kpiH, 4).fill("#334155");
    doc.fillColor("#94A3B8").font(FONTS.regular).fontSize(7.5)
      .text("TOTAL REVENUE (USD)", kpi2X + 8, kpiY + 7);
    doc.fillColor("#10B981").font(FONTS.bold).fontSize(13)
      .text(`$${totalCalculatedRevenue.toFixed(2)}`, kpi2X + 8, kpiY + 19);

    let currentY = bannerY + bannerH + 12;

    // Draw initial table header
    drawTableHeader(currentY);
    currentY += headerH;

    if (orders.length === 0) {
      // Empty State
      doc.rect(leftX, currentY, contentW, 60).fill("#F8FAFC");
      doc.rect(leftX, currentY, contentW, 60).strokeColor(COLORS.borderLight).stroke();
      doc.fillColor(COLORS.textSecondary).font(FONTS.bold).fontSize(10)
        .text("No paid ready orders found for this period.", leftX, currentY + 24, {
          width: contentW,
          align: "center",
        });
      currentY += 60;
    } else {
      // Draw Rows
      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];

        // Page break check
        if (currentY + rowH > maxY) {
          doc.addPage({ size: "A4", layout: "landscape", margin: 36 });
          currentY = 36;
          drawTableHeader(currentY);
          currentY += headerH;
        }

        const isEven = i % 2 === 0;
        const rowBg = isEven ? COLORS.rowEven : COLORS.rowOdd;

        // Row background
        doc.rect(leftX, currentY, contentW, rowH).fill(rowBg);
        // Bottom border
        doc.rect(leftX, currentY + rowH - 0.5, contentW, 0.5).fill(COLORS.borderLight);

        // 1. Index
        doc.fillColor(COLORS.textMuted).font(FONTS.regular).fontSize(7.5)
          .text(`${i + 1}`, cols[0].x, currentY + 6, { width: cols[0].w, align: "center" });

        // 2. Time
        const timeStr = formatCambodiaTime(order.paidAt || order.createdAt);
        doc.fillColor(COLORS.textSecondary).font(FONTS.regular).fontSize(7.5)
          .text(timeStr, cols[1].x, currentY + 6, { width: cols[1].w, align: "center" });

        // 3. Game
        const gameName = order.game?.name || "Game Top-Up";
        doc.fillColor(COLORS.textPrimary).font(FONTS.bold).fontSize(7.5)
          .text(gameName, cols[2].x + 3, currentY + 6, { width: cols[2].w - 6, ellipsis: true });

        // 4. Order Number
        doc.fillColor(COLORS.textPrimary).font(FONTS.bold).fontSize(7.5)
          .text(order.orderNumber, cols[3].x + 3, currentY + 6, { width: cols[3].w - 6, ellipsis: true });

        // 5. Player UID (and Server if present)
        const uidStr = order.serverId ? `${order.playerUid} (${order.serverId})` : order.playerUid;
        doc.fillColor(COLORS.textSecondary).font(FONTS.regular).fontSize(7.5)
          .text(uidStr, cols[4].x + 3, currentY + 6, { width: cols[4].w - 6, ellipsis: true });

        // 6. Package
        let pkgName = order.product?.name || "Top-up";
        if (order.product && (order.product.bonus ?? 0) > 0) {
          pkgName += ` (+${order.product.bonus})`;
        }
        doc.fillColor(COLORS.textSecondary).font(FONTS.regular).fontSize(7.5)
          .text(pkgName, cols[5].x + 3, currentY + 6, { width: cols[5].w - 6, ellipsis: true });

        // 7. Amount
        doc.fillColor(COLORS.textPrimary).font(FONTS.bold).fontSize(8)
          .text(`$${Number(order.amountUsd || 0).toFixed(2)}`, cols[6].x + 2, currentY + 6, {
            width: cols[6].w - 6,
            align: "right",
          });

        // 8. Status Pill
        const st = getStatusTheme(order.status);
        const pillW = cols[7].w - 10;
        const pillH = 14;
        const pillX = cols[7].x + 5;
        const pillY = currentY + 4;

        doc.roundedRect(pillX, pillY, pillW, pillH, 3).fill(st.bg);
        doc.fillColor(st.text).font(FONTS.bold).fontSize(6.5)
          .text((order.status || "UNKNOWN").toUpperCase(), pillX, pillY + 3.5, {
            width: pillW,
            align: "center",
          });

        // 9. IP Address
        const ipStr = order.ipAddress || "-";
        doc.fillColor(COLORS.textMuted).font(FONTS.regular).fontSize(7)
          .text(ipStr, cols[8].x + 3, currentY + 6, { width: cols[8].w - 6, ellipsis: true });

        currentY += rowH;
      }

      // Summary Total Row at the bottom of the table
      if (currentY + rowH > maxY) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 36 });
        currentY = 36;
        drawTableHeader(currentY);
        currentY += headerH;
      }

      // Total Row background
      doc.rect(leftX, currentY, contentW, rowH).fill("#F1F5F9");
      doc.rect(leftX, currentY + rowH - 1, contentW, 1).fill(COLORS.borderLight);

      doc.fillColor(COLORS.textPrimary).font(FONTS.bold).fontSize(8)
        .text(`TOTAL (${orders.length} orders)`, cols[0].x, currentY + 6, {
          width: cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w + cols[5].w,
          align: "right",
        });

      doc.fillColor(COLORS.brandPink).font(FONTS.bold).fontSize(8.5)
        .text(`$${totalCalculatedRevenue.toFixed(2)}`, cols[6].x + 2, currentY + 6, {
          width: cols[6].w - 6,
          align: "right",
        });

      currentY += rowH;
    }

    // ── FOOTERS ON ALL PAGES ─────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      // Subtle divider line
      doc.rect(leftX, 558, contentW, 0.5).fill(COLORS.borderLight);

      // Left footer
      doc.fillColor(COLORS.textMuted).font(FONTS.regular).fontSize(7)
        .text("DYTOPUP Automated Daily Report  •  Internal & Confidential", leftX, 566);

      // Right footer (Page number)
      doc.fillColor(COLORS.textMuted).font(FONTS.regular).fontSize(7)
        .text(`Page ${i + 1} of ${range.count}`, leftX, 566, {
          width: contentW,
          align: "right",
        });
    }

    doc.end();
  });
}

