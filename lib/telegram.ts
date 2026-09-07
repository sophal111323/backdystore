import { prisma } from "./prisma";

/**
 * Send a Telegram message using the bot token + chat id(s) stored in Settings
 * (falls back to env vars). The chat id accepts a comma-separated list, so one
 * alert can reach a private chat and a group at the same time.
 * Safe to call from any server code — never throws.
 */
export async function notifyTelegram(text: string): Promise<boolean> {
  try {
    const settings = await prisma.settings
      .findUnique({ where: { id: 1 } })
      .catch(() => null);

    const token = settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
    const rawChatIds = settings?.telegramChatId || process.env.TELEGRAM_CHAT_ID || "";
    const chatIds = rawChatIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!token || chatIds.length === 0) return false;

    const sent = await Promise.all(
      chatIds.map(async (chatId) => {
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }),
            cache: "no-store",
          });

          if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.warn(`[telegram] send to ${chatId} failed:`, res.status, body.slice(0, 200));
            return false;
          }
          return true;
        } catch (err) {
          console.warn(`[telegram] send to ${chatId} error:`, err);
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
