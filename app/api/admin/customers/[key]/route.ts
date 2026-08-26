import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { writeAuditForAdmin } from "@/lib/audit";

const patchSchema = z.object({
  ban: z.boolean().optional(),
  reason: z.string().max(1000).optional().nullable(),
});

function customerWhereFromKey(key: string) {
  if (key.startsWith("uid:")) return { playerUid: key.slice(4) };
  if (key.includes("@")) return { customerEmail: key };
  return { customerPhone: key };
}

function blockTypeFromKey(key: string) {
  if (key.startsWith("uid:")) return "uid";
  if (key.includes("@")) return "email";
  return "phone";
}

function blockValueFromKey(key: string) {
  return key.startsWith("uid:") ? key.slice(4) : key;
}

export const GET = withAdminAuth(
  async (_req, { params }: { params: Promise<{ key: string }> }) => {
    const { key: rawKey } = await params;
    const key = decodeURIComponent(rawKey);
    const where = customerWhereFromKey(key);

    const [orders, block] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          game: { select: { id: true, name: true, slug: true } },
          product: { select: { id: true, name: true } },
        },
        take: 100,
      }),
      prisma.blockedIdentity.findUnique({
        where: { type_value: { type: blockTypeFromKey(key), value: blockValueFromKey(key) } },
      }).catch(() => null),
    ]);

    if (orders.length === 0 && !block) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const paidOrders = orders.filter((o) => ["PAID", "PROCESSING", "DELIVERED"].includes(o.status));
    const lifetimeUsd = paidOrders.reduce((sum, o) => sum + o.amountUsd, 0);

    return NextResponse.json({
      customer: {
        key,
        email: orders[0]?.customerEmail ?? (key.includes("@") ? key : null),
        phone: orders[0]?.customerPhone ?? (!key.includes("@") && !key.startsWith("uid:") ? key : null),
        totalOrders: orders.length,
        paidOrders: paidOrders.length,
        lifetimeUsd: Math.round(lifetimeUsd * 100) / 100,
        banned: !!block,
        banReason: block?.reason ?? null,
      },
      orders,
    });
  },
  { permission: "customers.read" }
);

export const PATCH = withAdminAuth(
  async (req, { params }: { params: Promise<{ key: string }> }, admin) => {
    const { key: rawKey } = await params;
    const key = decodeURIComponent(rawKey);
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const type = blockTypeFromKey(key);
    const value = blockValueFromKey(key);

    if (parsed.data.ban === true) {
      const block = await prisma.blockedIdentity.upsert({
        where: { type_value: { type, value } },
        update: { reason: parsed.data.reason || null },
        create: { type, value, reason: parsed.data.reason || null },
      });
      await writeAuditForAdmin(admin, req, {
        action: "customer.ban",
        targetType: "customer",
        targetId: key,
        details: { type, value, reason: parsed.data.reason || null },
      });
      return NextResponse.json({ ok: true, banned: true, block });
    }

    if (parsed.data.ban === false) {
      await prisma.blockedIdentity.deleteMany({ where: { type, value } });
      await writeAuditForAdmin(admin, req, {
        action: "customer.unban",
        targetType: "customer",
        targetId: key,
        details: { type, value },
      });
      return NextResponse.json({ ok: true, banned: false });
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  },
  { permission: "customers.update" }
);
