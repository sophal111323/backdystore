import path from "node:path";
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// NOTE: The Content-Security-Policy header is intentionally NOT set here.
// A nonce-based CSP is generated on every request in middleware.ts, which
// injects `'nonce-{nonce}'` into script-src so 'unsafe-inline' is never needed.
//
// All other security headers remain here because they are static and do not
// require per-request values.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "fontkit"],
  outputFileTracingRoot: path.resolve(__dirname),
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ibb.co" },
      { protocol: "https", hostname: "api.qrserver.com" },
      { protocol: "https", hostname: "img.freepik.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.cloudinary.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
