// Generate secure human-friendly order number: RT-SO3JSJ6JJ0
export function generateOrderNumber(): string {
  const prefix = "RT";
  const length = 10;

  // Removed I and O to avoid confusion with 1 and 0
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);

  let randomPart = "";

  for (let i = 0; i < length; i++) {
    randomPart += chars[bytes[i] % chars.length];
  }

  return `${prefix}-${randomPart}`;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatKhr(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-US")} ៛`;
}

export function calcKhr(usd: number, rate: number = 4100): number {
  return Math.round((usd * rate) / 100) * 100; // round to nearest 100 KHR
}

// Validate UID format - basic: digits only, 6-20 chars
export function isValidUid(uid: string): boolean {
  return /^\d{6,20}$/.test(uid.trim());
}

// Validate server zone id
export function isValidServerId(sid: string): boolean {
  return /^\d{1,5}$/.test(sid.trim());
}