/**
 * lib/accessKey.ts — Admin access key (login step 2 of 3)
 *
 * Requirements:
 * 1. 256-character cryptographically random key.
 * 2. Generated and rotated every 1 hour (1time/1h) and sent to Telegram Bot.
 * 3. Static master key fallback via ADMIN_ACCESS_KEY_HASH.
 */

import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { notifyTelegram, escapeHtml } from "./telegram";

export const ACCESS_KEY_PENDING_COOKIE = "admin_key_pending";
export const ACCESS_KEY_PENDING_TYPE = "admin-access-key-pending";

export const ACCESS_KEY_LENGTH = 256;
const BCRYPT_ROUNDS = 12;

// 1 hour in milliseconds
export const ACCESS_KEY_TTL_MS = 60 * 60 * 1000;

interface HourlyAccessKey {
  key: string; // The 256-character key
  codeHash: string; // sha256 hash
  expiresAt: number; // timestamp in ms (1 hour from creation)
  createdAt: number;
}

// Global persistent state across Next.js API route invocations
interface GlobalAccessKeyState {
  currentHourlyKey?: HourlyAccessKey;
  routineStarted?: boolean;
  lastSentAt?: number;
}

const state: GlobalAccessKeyState =
  (globalThis as unknown as { __hourlyAccessKeyState?: GlobalAccessKeyState }).__hourlyAccessKeyState ||
  ((globalThis as unknown as { __hourlyAccessKeyState: GlobalAccessKeyState }).__hourlyAccessKeyState = {});

function digestKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("base64");
}

function hashCode(code: string): string {
  return createHash("sha256").update(code.trim(), "utf8").digest("hex");
}

/**
 * Generates an exact 256-character alphanumeric string [A-Za-z0-9]
 */
export function generate256CharKey(): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(256);
  let key = "";
  for (let i = 0; i < 256; i++) {
    key += charset[bytes[i] % charset.length];
  }
  return key;
}

export function generateAccessKey(): string {
  return generate256CharKey();
}

export function hashAccessKey(key: string): Promise<string> {
  return bcrypt.hash(digestKey(key), BCRYPT_ROUNDS);
}

export function isAccessKeyConfigured(): boolean {
  return true;
}

/**
 * Formats time in Cambodia timezone (Asia/Phnom_Penh)
 */
function formatKhmerTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: "Asia/Phnom_Penh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/**
 * Sends a 256-character access key notification to Telegram.
 */
async function sendKeyToTelegram(
  key: string,
  expiresAt: number,
  reason = "ប្រព័ន្ធបង្កើតស្វ័យប្រវត្តរៀងរាល់ 1 ម៉ោង (Hourly 1h)"
): Promise<boolean> {
  const createdDate = new Date();
  const expireDate = new Date(expiresAt);

  const phnomPenhCreated = formatKhmerTime(createdDate);
  const phnomPenhExpiry = formatKhmerTime(expireDate);

  const message = [
    `🔐 <b>DYTOPUP — Admin Access Key (256 Characters)</b>`,
    ``,
    `🔑 <b>កូដសម្ងាត់ Access Key របស់អ្នកគឺ៖</b>`,
    `<code>${key}</code>`,
    ``,
    `<i>(ចុចលើកូដខាងលើដើម្បី Copy ទាំងអស់)</i>`,
    ``,
    `⏱️ <b>សុពលភាព៖</b> ១ ម៉ោង (1 Hour)`,
    `🕒 <b>បង្កើតនៅ៖</b> ${phnomPenhCreated}`,
    `⏳ <b>ផុតកំណត់នៅ៖</b> ${phnomPenhExpiry}`,
    `🔢 <b>ប្រវែង៖</b> 256 តួអក្សរ`,
    `📌 <b>មូលហេតុ៖</b> ${escapeHtml(reason)}`,
    ``,
    `⚠️ <i>កូដនេះត្រូវបានបង្កើតស្វ័យប្រវត្តរៀងរាល់ 1 ម៉ោងម្តង (1 time / 1h)។ សូមរក្សាទុកជាការសម្ងាត់ខ្ពស់បំផុត!</i>`,
  ].join("\n");

  console.log("================================================================================");
  console.log("🔑 [DYTOPUP 256-CHAR ACCESS KEY - VALID 1 HOUR]:");
  console.log(key);
  console.log("================================================================================");
  console.log(`[accessKey] Sending 256-char Access Key to Telegram...`);
  const sent = await notifyTelegram(message);
  console.log(`[accessKey] Telegram notification result: ${sent ? "SENT" : "FAILED"}`);
  state.lastSentAt = Date.now();
  return sent;
}

export function getActiveHourlyAccessKey(): string | null {
  const now = Date.now();
  if (state.currentHourlyKey && state.currentHourlyKey.expiresAt > now) {
    return state.currentHourlyKey.key;
  }
  return null;
}

/**
 * Gets or creates the active 1-hour 256-character key.
 * If expired or none exists, creates a fresh one and sends to Telegram.
 */
export async function getOrCreateHourlyAccessKey(
  forceNew = false,
  reason?: string
): Promise<{ key: string; expiresAt: number; isNew: boolean }> {
  const now = Date.now();

  if (!forceNew && state.currentHourlyKey && state.currentHourlyKey.expiresAt > now) {
    return {
      key: state.currentHourlyKey.key,
      expiresAt: state.currentHourlyKey.expiresAt,
      isNew: false,
    };
  }

  // Create brand new 256-character key valid for 1 hour
  const key = generate256CharKey();
  const codeHash = hashCode(key);
  const expiresAt = now + ACCESS_KEY_TTL_MS;

  state.currentHourlyKey = {
    key,
    codeHash,
    expiresAt,
    createdAt: now,
  };

  void sendKeyToTelegram(key, expiresAt, reason || "បង្កើតកូដ 256 តួអក្សរថ្មីសម្រាប់ ១ ម៉ោង");

  return { key, expiresAt, isNew: true };
}

/**
 * Starts background interval to rotate key every 1 hour automatically
 */
export function initHourlyAccessKeyRoutine() {
  if (state.routineStarted) return;
  state.routineStarted = true;

  // Initialize first key if not present
  void getOrCreateHourlyAccessKey(false, "ប្រព័ន្ធចាប់ផ្តើមដំណើរការ (System Start)");

  // Check every 30 seconds if 1 hour has elapsed
  setInterval(() => {
    const now = Date.now();
    if (!state.currentHourlyKey || state.currentHourlyKey.expiresAt <= now) {
      console.log("[accessKey] 1 hour elapsed — rotating 256-char key now...");
      void getOrCreateHourlyAccessKey(true, "ប្រព័ន្ធផ្លាស់ប្តូរស្វ័យប្រវត្តរៀងរាល់ 1 ម៉ោង (Hourly 1h)");
    }
  }, 30 * 1000);
}

// Auto-start routine on load
initHourlyAccessKeyRoutine();

/**
 * Generates and sends / resends the 256-character 1-hour Access Key to Telegram
 */
export async function generateAndSendTelegramAccessKey(
  _adminId: string,
  _email: string,
  _ip: string,
  forceRegenerate = false
): Promise<{ success: boolean; error?: string; retryAfterSeconds?: number }> {
  const now = Date.now();
  const lastSent = state.lastSentAt || 0;
  const cooldownMs = 15 * 1000; // 15s cooldown between Telegram messages

  if (now - lastSent < cooldownMs) {
    const waitSec = Math.ceil((cooldownMs - (now - lastSent)) / 1000);
    return {
      success: false,
      error: `សូមរង់ចាំ ${waitSec} វិនាទីសិន មុនពេលផ្ញើសារថ្មីទៅ Telegram។`,
      retryAfterSeconds: waitSec,
    };
  }

  const { key, expiresAt } = await getOrCreateHourlyAccessKey(forceRegenerate, "Admin បានស្នើសុំផ្ញើកូដ Access Key");
  const sent = await sendKeyToTelegram(key, expiresAt, "Admin ស្នើសុំកូដ Access Key ចូលប្រព័ន្ធ");

  return { success: sent };
}

/**
 * Detailed verification for the 256-character Access Key.
 */
export async function verifyAccessKeyDetailed(
  key: string,
  _adminId?: string
): Promise<{ valid: boolean; reason?: "expired" | "invalid" }> {
  const trimmed = key.trim();
  if (!trimmed) return { valid: false, reason: "invalid" };

  const now = Date.now();

  // 1. Check current active hourly key
  if (state.currentHourlyKey) {
    if (now > state.currentHourlyKey.expiresAt) {
      return { valid: false, reason: "expired" };
    }

    const inputHash = hashCode(trimmed);
    const bufA = Buffer.from(inputHash, "hex");
    const bufB = Buffer.from(state.currentHourlyKey.codeHash, "hex");

    if (bufA.length === bufB.length && timingSafeEqual(bufA, bufB)) {
      return { valid: true };
    }
  }

  // 2. Check static master key held in ADMIN_ACCESS_KEY_HASH (fallback)
  const masterHash = process.env.ADMIN_ACCESS_KEY_HASH?.trim();
  if (masterHash) {
    try {
      const match = await bcrypt.compare(digestKey(trimmed), masterHash);
      if (match) return { valid: true };
    } catch {}
  }

  return { valid: false, reason: "invalid" };
}

/**
 * Default boolean check for backward compatibility.
 */
export async function verifyAccessKey(
  key: string,
  adminId?: string
): Promise<boolean> {
  const res = await verifyAccessKeyDetailed(key, adminId);
  return res.valid;
}
