import { NextRequest } from "next/server";

/** Basic IPv4 / IPv6 format check — rejects forged header values. */
function isValidIp(ip: string): boolean {
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip.split(".").every((octet) => Number(octet) <= 255);
  }
  // IPv6 (simplified — accepts standard and compressed forms)
  if (/^[0-9a-fA-F:]+$/.test(ip) && ip.includes(":")) {
    return true;
  }
  return false;
}

/**
 * Extract the real client IP safely.
 *
 * Priority:
 * 1. x-real-ip  — set directly by Vercel/Nginx to the real client IP (hardest to spoof)
 * 2. x-forwarded-for (leftmost valid IP) — Vercel format: "clientIP, vercelProxyIP"
 *    → leftmost = real client IP added by the first proxy
 *    → rightmost = Vercel's own load balancer IP (same for all users — breaks rate limiting!)
 * 3. Fallback: "unknown"
 *
 * SECURITY: Both headers can be forged if the app is NOT behind a trusted proxy
 * (Vercel / Nginx). Ensure your deployment always routes through a proxy that
 * strips or overwrites these headers before they reach the app.
 */
export function getClientIp(req: NextRequest): string {
  // Vercel / Nginx set this to the real client IP directly
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp && isValidIp(realIp)) return realIp;

  // x-forwarded-for: "clientIP, proxy1, proxy2"
  // → យក leftmost entry = IP ដែល client ផ្ញើ ហើយ proxy ទីមួយ (Vercel) បញ្ជាក់
  // → rightmost = Vercel load balancer IP — SAME for all users, breaks IP rate limiting
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    // Take the leftmost entry that is a syntactically valid IP.
    // This rejects header injection like: "x-forwarded-for: 1.1.1.1, evil-string"
    for (const ip of ips) {
      if (isValidIp(ip)) return ip;
    }
  }

  return "unknown";
}
