/**
 * lib/accessKey.ts — Admin access key (login step 2 of 3)
 *
 * The key is a single shared secret held only in ADMIN_ACCESS_KEY_HASH. The
 * plaintext is never stored, logged, or returned by any route — callers pass it
 * straight into verifyAccessKey and discard it.
 */

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";

export const ACCESS_KEY_PENDING_COOKIE = "admin_key_pending";
export const ACCESS_KEY_PENDING_TYPE = "admin-access-key-pending";

/** 750 random bytes encode to exactly 1000 unpadded base64url characters. */
const ACCESS_KEY_RANDOM_BYTES = 750;
export const ACCESS_KEY_LENGTH = 1000;

const BCRYPT_ROUNDS = 12;

/**
 * bcrypt truncates its input at 72 bytes without erroring, so hashing a
 * 1000-character key directly would make every string sharing its first 72
 * characters a valid key. Digesting first folds the whole key into 44 bytes.
 */
function digestKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("base64");
}

export function generateAccessKey(): string {
  return randomBytes(ACCESS_KEY_RANDOM_BYTES).toString("base64url");
}

export function hashAccessKey(key: string): Promise<string> {
  return bcrypt.hash(digestKey(key), BCRYPT_ROUNDS);
}

export function isAccessKeyConfigured(): boolean {
  return !!process.env.ADMIN_ACCESS_KEY_HASH?.trim();
}

/**
 * Returns false when ADMIN_ACCESS_KEY_HASH is unset so a missing env var locks
 * the admin panel instead of opening it.
 */
export async function verifyAccessKey(key: string): Promise<boolean> {
  const hash = process.env.ADMIN_ACCESS_KEY_HASH?.trim();
  if (!hash) return false;

  try {
    return await bcrypt.compare(digestKey(key), hash);
  } catch {
    return false;
  }
}
