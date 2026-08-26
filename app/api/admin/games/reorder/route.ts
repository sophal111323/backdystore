import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";

const schema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});

export const POST = withAdminAuth(
  async (req, _ctx, admin) => {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

    const all = await prisma.game.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const idx = all.findIndex((g) => g.id === parsed.data.id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const swapIdx = parsed.data.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= all.length) return NextResponse.json({ ok: true, skipped: true });

    const a = all[idx];
    const b = all[swapIdx];
    await prisma.$transaction([
      prisma.game.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
      prisma.game.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
    ]);

    if (a.sortOrder === b.sortOrder) {
      await prisma.$transaction(
        all.map((g, i) => prisma.game.update({ where: { id: g.id }, data: { sortOrder: i * 10 } }))
      );
    }

    await writeAuditForAdmin(admin, req, {
      action: "game.reorder",
      targetType: "game",
      targetId: a.id,
      details: { direction: parsed.data.direction },
    });
    revalidateAdminChange("games");

    return NextResponse.json({ ok: true });
  },
  { permission: "games.write" }
);
