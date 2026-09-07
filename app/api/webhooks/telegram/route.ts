import { NextRequest, NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegramBotService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

function getApiBase(): string {
  return process.env.TELEGRAM_API_BASE?.trim() || "https://api.telegram.org";
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (webhookSecret) {
      const tokenHeader = req.headers.get("x-telegram-bot-api-secret-token");
      if (tokenHeader !== webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    void handleTelegramUpdate(body).catch((err) => {
      console.error("[telegramWebhook] handleTelegramUpdate error:", err);
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[telegramWebhook] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = getBotToken();
  if (!token) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN is not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const apiBase = getApiBase();

  try {
    if (action === "info") {
      const res = await fetch(`${apiBase}/bot${token}/getWebhookInfo`, {
        cache: "no-store",
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === "delete") {
      const res = await fetch(`${apiBase}/bot${token}/deleteWebhook?drop_pending_updates=true`, {
        cache: "no-store",
      });
      const data = await res.json();
      return NextResponse.json({
        message: "Webhook deleted. Bot is now free for Long Polling.",
        result: data,
      });
    }

    if (action === "set") {
      const webhookUrl = searchParams.get("url");
      if (!webhookUrl) {
        return NextResponse.json(
          { error: "Missing url query parameter." },
          { status: 400 }
        );
      }

      const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
      const setUrl = new URL(`${apiBase}/bot${token}/setWebhook`);
      setUrl.searchParams.set("url", webhookUrl);
      if (secretToken) {
        setUrl.searchParams.set("secret_token", secretToken);
      }

      const res = await fetch(setUrl.toString(), { cache: "no-store" });
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({
      status: "ready",
      message: "Telegram webhook endpoint is active. Use ?action=info to inspect status.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
