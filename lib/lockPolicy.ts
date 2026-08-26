/**
 * lib/lockPolicy.ts — Progressive admin login/2FA lock schedule.
 *
 * Attempt 1  →  5 minutes
 * Attempt 2  → 10 minutes
 * Attempt 3  → 15 minutes
 * Attempt 4  → 30 minutes
 * Attempt 5  →  1 hour
 * Attempt 6+ → previous × 2  (capped at 7 days)
 *
 * No permanent / forever lock is generated here.
 * Manual account disable is handled by the Admin.active field separately.
 */

/** Fixed durations (ms) for the first 5 failure counts. */
const SCHEDULE_MS: readonly number[] = [
  5  * 60 * 1_000,  // 1st → 5 min
  10 * 60 * 1_000,  // 2nd → 10 min
  15 * 60 * 1_000,  // 3rd → 15 min
  30 * 60 * 1_000,  // 4th → 30 min
  60 * 60 * 1_000,  // 5th → 1 hour
] as const;

const MAX_LOCK_MS = 7 * 24 * 60 * 60 * 1_000; // 7-day safety cap

/**
 * Returns the lock duration in milliseconds for the given 1-indexed fail count.
 * e.g. getLockDurationMs(1) → 300_000 (5 min)
 *      getLockDurationMs(6) → 7_200_000 (2 hours)
 */
export function getLockDurationMs(failCount: number): number {
  const n = Math.max(1, Math.floor(failCount));

  if (n <= SCHEDULE_MS.length) {
    return SCHEDULE_MS[n - 1];
  }

  // For attempt 6+, double the previous step for each extra failure.
  let duration = SCHEDULE_MS[SCHEDULE_MS.length - 1];
  for (let i = SCHEDULE_MS.length; i < n; i++) {
    duration = duration * 2;
  }
  return Math.min(duration, MAX_LOCK_MS);
}

/**
 * Human-readable description of the lock duration.
 * Used in safe error messages returned to the client.
 */
export function formatLockDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1_000);
  const hours        = Math.floor(totalSeconds / 3_600);
  const minutes      = Math.floor((totalSeconds % 3_600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0)                 return `${hours} hour${hours > 1 ? "s" : ""}`;
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}
