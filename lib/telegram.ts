import { prisma } from "./prisma";
import { safeFetch } from "@/lib/safeFetch";

/**
 * Send a Telegram message using the bot token + chat id(s) stored in Settings
 * (falls back to env vars). The chat id accepts a comma-separated list, so one
 * alert can reach a private chat and a group at the same time.
 * Safe to call from any server code — never throws.
 */
export async function notifyTelegram(text: string): Promise<boolean> {
  try {
    let token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
    let rawChatIds = process.env.TELEGRAM_CHAT_ID?.trim() || "";

    // Quick lookup in DB if settings might override env (bounded to 1.5s so it never hangs)
    try {
      const dbPromise = prisma.settings.findUnique({ where: { id: 1 } });
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
      const settings = await Promise.race([dbPromise, timeoutPromise]);
      if (settings?.telegramBotToken) token = settings.telegramBotToken.trim();
      if (settings?.telegramChatId) rawChatIds = settings.telegramChatId.trim();
    } catch {
      // Use env values on DB error
    }

    const chatIds = rawChatIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!token || chatIds.length === 0) {
      console.warn("[telegram] Warning: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing");
      return false;
    }

    const apiBase = process.env.TELEGRAM_API_BASE?.trim() || "https://api.telegram.org";

    const sent = await Promise.all(
      chatIds.map(async (chatId) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await safeFetch(`${apiBase}/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }),
            signal: controller.signal,
            cache: "no-store",
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.warn(`[telegram] send to ${chatId} failed:`, res.status, body.slice(0, 200));
            return false;
          }
          return true;
        } catch (err: any) {
          clearTimeout(timeoutId);
          const isTimeout = err?.name === "AbortError" || err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" || String(err).includes("Timeout");
          if (isTimeout) {
            console.warn(`[telegram] send to ${chatId} timed out (local network / ISP may block Telegram).`);
          } else {
            console.warn(`[telegram] send to ${chatId} error:`, err?.message || err);
          }
          return false;
        }
      })
    );

    return sent.some(Boolean);
  } catch (err) {
    console.warn("[telegram] error:", err);
    return false;
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
