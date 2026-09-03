// lib/ipAllowlist.ts
//
// IP allowlist matcher for webhook / server-to-server endpoints.
//
// Supported entry formats (comma-separated env values):
//   - Exact IPv4:  "203.0.113.7"
//   - IPv4 CIDR:   "203.0.113.0/24"
//   - Exact IPv6:  "2001:db8::1" (no IPv6 CIDR support)
//
// Semantics:
//   - Env var unset/empty → allow everyone ({ configured: false }). The
//     caller's own HMAC signature check remains the hard auth gate.
//   - Env var set → the request IP MUST match at least one entry, otherwise
//     the request is rejected. Unknown/missing IPs are rejected too
//     (fail-closed while the allowlist is active).
//   - Malformed entries never match (fail-closed, never fail-open).
//
// Pure string/number logic only — safe in both Node and Edge runtimes.

export type IpAllowlistResult = {
  /** Whether the request IP may proceed. */
  allowed: boolean;
  /** Whether an allowlist is actually configured (env var non-empty). */
  configured: boolean;
};

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }

  return value >>> 0;
}

/**
 * Normalize an IP string: trim, lowercase, strip IPv6 brackets
 * ("[2001:db8::1]" → "2001:db8::1") and IPv6-mapped IPv4 prefixes
 * ("::ffff:1.2.3.4" → "1.2.3.4" — common behind proxies).
 */
export function normalizeIp(value: string): string {
  let ip = value.trim().toLowerCase();

  if (ip.startsWith("[") && ip.endsWith("]")) {
    ip = ip.slice(1, -1);
  }

  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) ip = mapped[1];

  return ip;
}

function ipMatchesEntry(ip: string, entry: string): boolean {
  const normIp = normalizeIp(ip);
  const normEntry = normalizeIp(entry);

  // IPv4 CIDR ranges ("203.0.113.0/24").
  const slash = normEntry.indexOf("/");
  if (slash !== -1) {
    const base = normEntry.slice(0, slash);
    const bitsRaw = normEntry.slice(slash + 1);

    if (!/^\d{1,2}$/.test(bitsRaw)) return false;
    const bits = Number(bitsRaw);
    if (bits > 32) return false;

    const baseInt = ipv4ToInt(base);
    const ipInt = ipv4ToInt(normIp);
    if (baseInt === null || ipInt === null) return false;

    if (bits === 0) return true; // "0.0.0.0/0" matches every IPv4 address
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return ((baseInt & mask) >>> 0) === ((ipInt & mask) >>> 0);
  }

  // Exact match (IPv4 or IPv6).
  return normIp === normEntry;
}

/** Parse a comma-separated allowlist env value into entries. */
export function parseIpAllowlist(raw: string | null | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Evaluate a request IP against an allowlist env value.
 *
 * Examples:
 *   isIpAllowedByEnv("203.0.113.7", "")                        // { allowed: true,  configured: false }
 *   isIpAllowedByIp("198.51.100.9", "203.0.113.0/24")          // { allowed: false, configured: true  }
 *   isIpAllowedByEnv("203.0.113.7", "203.0.113.0/24,10.0.0.5") // { allowed: true, configured: true  }
 *   isIpAllowedByEnv("unknown", "203.0.113.0/24")              // { allowed: false, configured: true  }
 */
export function isIpAllowedByEnv(
  ip: string | null | undefined,
  envValue: string | null | undefined
): IpAllowlistResult {
  const entries = parseIpAllowlist(envValue);
  if (entries.length === 0) {
    return { allowed: true, configured: false };
  }

  const candidate = (ip || "").trim();
  if (!candidate || candidate.toLowerCase() === "unknown") {
    // No verifiable IP while an allowlist is active → reject.
    return { allowed: false, configured: true };
  }

  const allowed = entries.some((entry) => ipMatchesEntry(candidate, entry));
  return { allowed, configured: true };
}
