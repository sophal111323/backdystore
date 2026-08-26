import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";

const paidLikeStatuses = ["PAID", "PROCESSING", "DELIVERED"];

export const GET = withAdminAuth(
  async (req) => {
    const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase();

    const orders = await prisma.order.findMany({
      take: 5000,
      orderBy: { createdAt: "desc" },
      select: {
        customerEmail: true,
        customerPhone: true,
        playerUid: true,
        playerNickname: true,
        amountUsd: true,
        status: true,
        createdAt: true,
      },
    });

    const map = new Map<
      string,
      {
        key: string;
        email: string | null;
        phone: string | null;
        nickname: string | null;
        totalOrders: number;
        paidOrders: number;
        lifetimeUsd: number;
        lastOrderAt: Date;
        uids: Set<string>;
      }
    >();

    for (const o of orders) {
      const key = o.customerEmail || o.customerPhone || `uid:${o.playerUid}`;
      const existing = map.get(key);
      const isPaid = paidLikeStatuses.includes(o.status);
      if (existing) {
        existing.totalOrders += 1;
        if (isPaid) existing.paidOrders += 1;
        if (isPaid) existing.lifetimeUsd += o.amountUsd;
        if (o.createdAt > existing.lastOrderAt) existing.lastOrderAt = o.createdAt;
        existing.uids.add(o.playerUid);
        if (!existing.nickname && o.playerNickname) existing.nickname = o.playerNickname;
      } else {
        map.set(key, {
          key,
          email: o.customerEmail,
          phone: o.customerPhone,
          nickname: o.playerNickname,
          totalOrders: 1,
          paidOrders: isPaid ? 1 : 0,
          lifetimeUsd: isPaid ? o.amountUsd : 0,
          lastOrderAt: o.createdAt,
          uids: new Set([o.playerUid]),
        });
      }
    }

    let customers = [...map.values()].map((c) => ({
      key: c.key,
      email: c.email,
      phone: c.phone,
      nickname: c.nickname,
      totalOrders: c.totalOrders,
      paidOrders: c.paidOrders,
      lifetimeUsd: Math.round(c.lifetimeUsd * 100) / 100,
      lastOrderAt: c.lastOrderAt,
      uidCount: c.uids.size,
    }));

    if (q) {
      customers = customers.filter((c) =>
        [c.key, c.email, c.phone, c.nickname].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
      );
    }

    customers.sort((a, b) => b.lifetimeUsd - a.lifetimeUsd);

    return NextResponse.json({ customers, total: customers.length });
  },
  { permission: "customers.read" }
);
