import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";

export const dynamic = "force-dynamic";

export const DELETE = withAdminAuth(async (_req, ctx, _admin) => {
  const params = await ctx.params;
  const id = params.id;

  if (!id) {
    return NextResponse.json(
      { error: "Missing blocked identity id" },
      { status: 400 }
    );
  }

  const deleted = await prisma.blockedIdentity.deleteMany({
    where: { id },
  });

  if (deleted.count === 0) {
    return NextResponse.json(
      { error: "Blocked identity not found" },
      { status: 404 }
    );
  }

  await writeAudit({
    action: "banlist.remove",
    targetType: "banlist",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
});