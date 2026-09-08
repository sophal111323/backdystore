/**
 * lib/telegramBotService.ts — Telegram Bot command handler and background polling.
 *
 * Commands supported:
 * /key, /getkey, key — returns the current active 256-character Access Key.
 * /newkey — forces generation of a brand new 256-character Access Key.
 * /status — shows server status and current Access Key remaining time.
 * /help, /start — shows command guide in Khmer.
 */

import { escapeHtml } from "./telegram";
import { safeFetch } from "@/lib/safeFetch";
import {
  getOrCreateHourlyAccessKey,
  ACCESS_KEY_TTL_MS,
} from "./accessKey";
import { prisma } from "@/lib/prisma";
import { refreshTopupStatus } from "@/lib/fulfillment";
import { syncSinglePendingOrder } from "@/lib/paymentSyncService";

const state = (globalThis as unknown as {
  __telegramPollerRunning?: boolean;
  __telegramPollerOffset?: number;
}).__telegramPollerRunning
  ? (globalThis as unknown as {
      __telegramPollerRunning: boolean;
      __telegramPollerOffset: number;
    })
  : ((globalThis as unknown as {
      __telegramPollerRunning: boolean;
      __telegramPollerOffset: number;
    }) = {
      __telegramPollerRunning: false,
      __telegramPollerOffset: 0,
    });

function getBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

function getAuthorizedChatIds(): string[] {
  const raw = process.env.TELEGRAM_CHAT_ID?.trim() || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getApiBase(): string {
  return process.env.TELEGRAM_API_BASE?.trim() || "https://api.telegram.org";
}

/**
 * Sends a message to a specific Telegram chat id.
 */
export async function sendTelegramToChat(
  chatId: string | number,
  text: string
): Promise<boolean> {
  const token = getBotToken();
  if (!token) return false;

  const apiBase = getApiBase();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

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
    return res.ok;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[telegramBot] send to ${chatId} failed:`, err);
    return false;
  }
}

/**
 * Processes an incoming Telegram message update (from Webhook or Polling).
 */
export async function handleTelegramUpdate(update: any): Promise<void> {
  const msg = update?.message || update?.edited_message;
  if (!msg || !msg.chat || !msg.text) return;

  const chatId = String(msg.chat.id);
  const text = String(msg.text).trim();
  const rawToken = text.toLowerCase().split(/\s+/)[0] || "";
  const command = rawToken.split("@")[0].replace(/^\/+/, ""); // 'key', 'newkey', 'generate', 'status', etc.

  const authorizedChatIds = getAuthorizedChatIds();
  const isAuthorized =
    authorizedChatIds.length === 0 || authorizedChatIds.includes(chatId);

  if (!isAuthorized) {
    console.warn(`[telegramBot] Unauthorized access attempt from chatId: ${chatId}`);
    await sendTelegramToChat(
      chatId,
      `⛔ <b>ចូលប្រើប្រាស់មិនបានជោគជ័យ</b>\n\nChat ID <code>${chatId}</code> របស់អ្នកមិនមានសិទ្ធិស្នើសុំ Access Key របស់ DYTOPUP ឡើយ។`
    );
    return;
  }

  const phnomPenhTime = (date: Date) =>
    date.toLocaleTimeString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

  // Generate a brand new 256-character key
  if (
    command === "newkey" ||
    command === "gen" ||
    command === "generate" ||
    command === "genkey" ||
    command === "createkey"
  ) {
    const { key, expiresAt } = await getOrCreateHourlyAccessKey(
      true,
      "Admin បានវាយបញ្ជាបង្កើតកូដ 256 តួអក្សរថ្មីតាម Telegram"
    );

    const createdDate = new Date();
    const expireDate = new Date(expiresAt);

    const reply = [
      `🆕 <b>DYTOPUP — Access Key ថ្មីស្រឡាង (256 Characters)</b>`,
      ``,
      `🔑 <b>កូដ Access Key 256 តួអក្សរថ្មីរបស់អ្នកគឺ៖</b>`,
      `<code>${key}</code>`,
      ``,
      `<i>(ចុចលើកូដខាងលើដើម្បី Copy ទាំងអស់)</i>`,
      ``,
      `⏱️ <b>សុពលភាព៖</b> ១ ម៉ោង (1 Hour)`,
      `🕒 <b>បង្កើតនៅ៖</b> ${phnomPenhTime(createdDate)}`,
      `⏳ <b>ផុតកំណត់នៅ៖</b> ${phnomPenhTime(expireDate)}`,
      `🔢 <b>ប្រវែង៖</b> 256 Characters`,
      ``,
      `⚠️ <i>កូដចាស់ត្រូវបានជំនួស។ សូមប្រើកូដថ្មីនេះដើម្បី Login ចូល Admin។</i>`,
    ].join("\n");

    await sendTelegramToChat(chatId, reply);
    return;
  }

  // Get active 256-character key (or create one if expired)
  if (
    command === "key" ||
    command === "getkey" ||
    command === "code" ||
    command === "accesskey" ||
    command === "token"
  ) {
    const { key, expiresAt, isNew } = await getOrCreateHourlyAccessKey(
      false,
      "Admin បានវាយបញ្ជាស្នើសុំ /key ក្នុង Telegram"
    );

    const now = Date.now();
    const remainingMinutes = Math.max(1, Math.ceil((expiresAt - now) / 60000));
    const createdDate = new Date(expiresAt - ACCESS_KEY_TTL_MS);
    const expireDate = new Date(expiresAt);

    const reply = [
      `🔐 <b>DYTOPUP — Admin Access Key (256 Characters)</b>`,
      ``,
      isNew
        ? `✨ <b>កូដថ្មីទើបតែបង្កើត៖</b>`
        : `🔑 <b>កូដសកម្មបច្ចុប្បន្ន (នៅសល់ ${remainingMinutes} នាទីទៀត)៖</b>`,
      `<code>${key}</code>`,
      ``,
      `<i>(ចុចលើកូដខាងលើដើម្បី Copy ទាំងអស់)</i>`,
      ``,
      `⏱️ <b>សុពលភាព៖</b> ១ ម៉ោង (នៅសល់ ${remainingMinutes} នាទី)`,
      `🕒 <b>បង្កើតនៅ៖</b> ${phnomPenhTime(createdDate)}`,
      `⏳ <b>ផុតកំណត់នៅ៖</b> ${phnomPenhTime(expireDate)}`,
      `🔢 <b>ប្រវែង៖</b> 256 Characters`,
      ``,
      `💡 <i>វាយ <code>/newkey</code> ឬ <code>/generate</code> ប្រសិនបើអ្នកចង់បង្កើតកូដ 256 តួអក្សរថ្មីភ្លាមៗ។</i>`,
    ].join("\n");

    await sendTelegramToChat(chatId, reply);
    return;
  }

  // /status
  if (command === "status") {
    const { expiresAt } = await getOrCreateHourlyAccessKey(false);
    const now = Date.now();
    const remainingMinutes = Math.max(0, Math.ceil((expiresAt - now) / 60000));

    const reply = [
      `📊 <b>DYTOPUP — Server & Access Key Status</b>`,
      ``,
      `🟢 <b>Server Status:</b> Online`,
      `⏱️ <b>Access Key Status:</b> ${remainingMinutes > 0 ? "Active ✅" : "Expired ⚠️"}`,
      `⏳ <b>នៅសល់ពេល៖</b> ${remainingMinutes} នាទី (រៀងរាល់ 1 ម៉ោងប្តូរម្តង)`,
      `🕒 <b>ផុតកំណត់នៅ៖</b> ${phnomPenhTime(new Date(expiresAt))}`,
      ``,
      `👉 វាយ <code>/key</code> ដើម្បីទាញយកកូដ ឬ <code>/newkey</code> ដើម្បីបង្កើតកូដថ្មី`,
    ].join("\n");

    await sendTelegramToChat(chatId, reply);
    return;
  }

  // /help or /start
  if (command === "help" || command === "start") {
    const reply = [
      `👋 <b>សួស្តី Admin! ស្វាគមន៍មកកាន់ DYTOPUP Bot</b>`,
      ``,
      `Bot នេះអាចជួយអ្នកបង្កើត និងទាញយក Access Key 256 Characters ចូល Admin យ៉ាងរហ័ស៖`,
      ``,
      `👉 <code>/key</code> — ទាញយកកូដ Access Key 256 តួអក្សរបច្ចុប្បន្ន`,
      `👉 <code>/newkey</code> — បង្កើតកូដ Access Key 256 តួអក្សរថ្មីភ្លាមៗ`,
      `👉 <code>/status</code> — ពិនិត្យមើលសុពលភាពនៃ Key និង Server`,
      `👉 <code>/help</code> — បង្ហាញការណែនាំនេះឡើងវិញ`,
      ``,
      `⏱️ <i>ប្រព័ន្ធបង្កើត Access Key 256 តួអក្សរស្វ័យប្រវត្តរៀងរាល់ 1 ម៉ោងម្តង (1 time / 1h)។</i>`,
    ].join("\n");

    await sendTelegramToChat(chatId, reply);
    return;
  }

  // Check / refresh order command (e.g. /check RT-..., /order RT-..., or typing #RT-...)
  const isOrderQuery =
    command === "check" ||
    command === "order" ||
    /^(RT-|ORD-)/i.test(rawToken.replace(/^#/, ""));

  if (isOrderQuery) {
    const textTokens = text.split(/\s+/);
    let orderNum = textTokens[1] || textTokens[0] || rawToken;
    orderNum = orderNum.replace(/^#/, "").trim().toUpperCase();

    if (orderNum.length >= 5) {
      const order = await prisma.order.findUnique({
        where: { orderNumber: orderNum },
        include: { game: true, product: true },
      });

      if (!order) {
        await sendTelegramToChat(
          chatId,
          `⚠️ <b>រកមិនឃើញ Order: #${escapeHtml(orderNum)}</b>\n\nសូមពិនិត្យមើលលេខ Order ឡើងវិញ។`
        );
        return;
      }

      // If PROCESSING, live check provider status right away
      if (order.status === "PROCESSING" && order.topupProviderRef) {
        await refreshTopupStatus(order.orderNumber);
      } else if (order.status === "PENDING" && order.paymentRef) {
        await syncSinglePendingOrder(order.id);
      }

      // Fetch latest order state
      const current =
        (await prisma.order.findUnique({
          where: { id: order.id },
          include: { game: true, product: true },
        })) || order;

      const statusIcon =
        current.status === "DELIVERED"
          ? "✅"
          : current.status === "PAID"
          ? "💰"
          : current.status === "PROCESSING"
          ? "⏳"
          : current.status === "PENDING"
          ? "🟡"
          : "⚠️";

      const reply = [
        `📦 <b>Order Status: #${escapeHtml(current.orderNumber)}</b>`,
        ``,
        `🎮 <b>ហ្គេម៖</b> ${escapeHtml(current.game.name)} – ${escapeHtml(current.product.name)}`,
        `👤 <b>UID:</b> <code>${escapeHtml(current.playerUid)}</code>`,
        `💵 <b>តម្លៃ៖</b> $${current.amountUsd.toFixed(2)}`,
        `📊 <b>ស្ថានភាព៖</b> ${statusIcon} <b>${current.status}</b>`,
        current.topupProviderRef
          ? `🔗 <b>Ref:</b> <code>${escapeHtml(current.topupProviderRef)}</code>`
          : "",
        current.deliveryNote ? `📝 <i>${escapeHtml(current.deliveryNote)}</i>` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await sendTelegramToChat(chatId, reply);
      return;
    }
  }

  // Default fallback for any other message
  await sendTelegramToChat(
    chatId,
    `🤖 <b>DYTOPUP Bot</b>\n\nសូមវាយ <code>/key</code> ដើម្បីទទួល Access Key 256 តួអក្សរ, <code>/newkey</code> ដើម្បីបង្កើតកូដថ្មី, ឬវាយលេខ <b>#OrderNumber</b> ដើម្បីពិនិត្យស្ថានភាព Order។`
  );
}

/**
 * Starts background long-polling for Telegram updates.
 * Runs in background without blocking server operations.
 */
export function startTelegramBotPoller(): void {
  const token = getBotToken();
  if (!token) return;

  if (state.__telegramPollerRunning) return;
  state.__telegramPollerRunning = true;

  const apiBase = getApiBase();
  let pollActive = true;

  console.log("[telegramBot] Starting Telegram bot command listener...");

  const poll = async () => {
    while (pollActive) {
      try {
        const offset = state.__telegramPollerOffset || 0;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        const res = await safeFetch(
          `${apiBase}/bot${token}/getUpdates?offset=${offset}&timeout=25`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        clearTimeout(timeoutId);

        if (!res.ok) {
          // If webhook is active, getUpdates returns 409 Conflict. Stop polling gracefully.
          if (res.status === 409) {
            console.info("[telegramBot] Webhook is active. Poller stepping aside.");
            pollActive = false;
            state.__telegramPollerRunning = false;
            break;
          }
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }

        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.result) && data.result.length > 0) {
          for (const update of data.result) {
            state.__telegramPollerOffset = (update.update_id || 0) + 1;
            void handleTelegramUpdate(update).catch((err) =>
              console.error("[telegramBot] Update handler error:", err)
            );
          }
        }
      } catch (err: any) {
        // Network timeout / connect errors: back off gently for 8s
        await new Promise((r) => setTimeout(r, 8000));
      }
    }
  };

  void poll();
}

// Auto-start listener
if (typeof window === "undefined") {
  startTelegramBotPoller();
}

