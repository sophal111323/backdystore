/**
 * lib/lockPolicy.ts — Progressive admin login/2FA lock schedule.
 *
 * Attempt 1-2 → No lock (track failCount, allow immediate retry)
 * Attempt 3   → Lock 1 minute
 * Attempt 4   → Lock 5 minutes
 * Attempt 5   → Lock 15 minutes
 * Attempt 6+  → Lock 30 minutes (capped at 1 hour)
 *
 * No permanent / forever lock is generated automatically.
 * Manual account disable is handled by the Admin.active field separately.
 */

/**
 * Returns the lock duration in milliseconds for the given 1-indexed fail count.
 * Fail 1 & 2: 0 ms (no lock)
 * Fail 3: 1 minute
 * Fail 4: 5 minutes
 * Fail 5: 15 minutes
 * Fail 6+: 30 minutes
 */
export function getLockDurationMs(failCount: number): number {
  const n = Math.floor(failCount);
  if (n < 3) return 0;
  if (n === 3) return 1 * 60 * 1_000;   // 3rd fail → 1 minute
  if (n === 4) return 5 * 60 * 1_000;   // 4th fail → 5 minutes
  if (n === 5) return 15 * 60 * 1_000;  // 5th fail → 15 minutes
  return 30 * 60 * 1_000;               // 6th+ → 30 minutes
}

/**
 * Human-readable description of the lock duration (Khmer / clear units).
 */
export function formatLockDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1_000);
  const hours        = Math.floor(totalSeconds / 3_600);
  const minutes      = Math.floor((totalSeconds % 3_600) / 60);
  const seconds      = totalSeconds % 60;

  if (hours > 0 && minutes > 0) return `${hours} ម៉ោង ${minutes} នាទី`;
  if (hours > 0)                 return `${hours} ម៉ោង`;
  if (minutes > 0 && seconds > 0) return `${minutes} នាទី ${seconds} វិនាទី`;
  if (minutes > 0)               return `${minutes} នាទី`;
  return `${seconds} វិនាទី`;
}

