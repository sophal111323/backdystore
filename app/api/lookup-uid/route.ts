import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimitMemory } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getIp";
import {
  getGameLookupConfig,
  lookupBay2GameNickname,
} from "@/lib/gameLookup/bay2game";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  gameSlug: z.string().trim().min(1).max(60),
  uid: z.string().trim().min(1).max(30),
  server: z.string().trim().min(1).max(20).optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  if (!checkRateLimitMemory(`uid-lookup:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { nickname: null, verified: false, error: "Too many requests — try again shortly" },
      { status: 429 },
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { nickname: null, verified: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        nickname: null,
        verified: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      },
      { status: 400 },
    );
  }

  const { gameSlug, uid, server } = parsed.data;
  const cfg = getGameLookupConfig(gameSlug);

  if (!cfg) {
    return NextResponse.json({
      nickname: null,
      verified: false,
      error: "This game does not support ID check yet",
    });
  }

  if (cfg.needsServer && !server?.trim()) {
    return NextResponse.json(
      { nickname: null, verified: false, error: "Server ID is required" },
      { status: 400 },
    );
  }

  const result = await lookupBay2GameNickname(
    gameSlug,
    uid.trim(),
    cfg.needsServer ? server?.trim() : undefined,
  );

  return NextResponse.json({
    nickname: result.username,
    verified: result.success && Boolean(result.username),
    ...(result.region ? { region: result.region } : {}),
    ...(result.game ? { game: result.game } : {}),
    ...(result.error && !result.success ? { error: result.error } : {}),
  });
}
