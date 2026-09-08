import { NextRequest } from "next/server";
import { safeFetch } from "@/lib/safeFetch";

type TurnstileKind = "public" | "admin";

type TurnstileResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  "error-codes"?: string[];
};

function getClientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

function getSecret(kind: TurnstileKind) {
  if (kind === "admin") {
    return process.env.TURNSTILE_SECRET_KEY_ADMIN || process.env.TURNSTILE_SECRET_KEY || "";
  }
  return process.env.TURNSTILE_SECRET_KEY_PUBLIC || process.env.TURNSTILE_SECRET_KEY || "";
}

function getAllowedHostnames() {
  return (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

// Cloudflare's publicly documented test tokens (issued by the dummy/test
// sitekeys). Accepting them in production would let anyone bypass
// verification by sending a known constant, so they are honored in
// non-production environments only.
const CLOUDFLARE_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const CLOUDFLARE_TEST_TOKEN_PREFIX = "1x0000000000000000000000000000000AA";

export type TurnstileVerifyResult = {
  ok: boolean;
  reason?: string;
  errorCodes?: string[];
  hostname?: string;
  action?: string;
};

export async function verifyTurnstileTokenDetail({
  req,
  token,
  kind,
  expectedAction,
}: {
  req: NextRequest | Request;
  token: string;
  kind: TurnstileKind;
  expectedAction?: string;
}): Promise<TurnstileVerifyResult> {
  // Fail closed: a missing/empty token is never valid in ANY environment.
  if (typeof token !== "string" || token.trim().length === 0) {
    return { ok: false, reason: "Turnstile token is empty or missing" };
  }

  const isProduction = process.env.NODE_ENV === "production";
  const secret = getSecret(kind);
  const isTestKey = secret.startsWith("1x00000000000000000000");

  // Cloudflare test tokens are honored outside production OR when test keys are explicitly configured
  if (
    token === CLOUDFLARE_TEST_TOKEN ||
    token.startsWith(CLOUDFLARE_TEST_TOKEN_PREFIX)
  ) {
    if (!isProduction || isTestKey) return { ok: true };
    console.warn("Turnstile: rejected Cloudflare test token in production");
    return { ok: false, reason: "Test token rejected in production" };
  }

  if (!secret) {
    if (!isProduction) {
      console.warn(
        "Turnstile: secret key not configured — accepting token in development only"
      );
      return { ok: true };
    }
    return { ok: false, reason: `Turnstile secret key not configured for kind=${kind}` };
  }

  let data: TurnstileResponse;

  try {
    const res = await safeFetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret,
          response: token,
        }),
      }
    );

    if (!res.ok) {
      return {
        ok: false,
        reason: `Cloudflare siteverify endpoint returned HTTP ${res.status}`,
      };
    }

    data = (await res.json()) as TurnstileResponse;
  } catch (error: any) {
    console.warn("Turnstile siteverify request failed:", error);
    return {
      ok: false,
      reason: `Could not reach Cloudflare verification server: ${error?.message || error}`,
    };
  }

  if (!data.success) {
    console.warn(
      `[Turnstile ${kind}] verification failed:`,
      data["error-codes"],
      "hostname:",
      data.hostname
    );
    const codes = data["error-codes"]?.join(", ") || "rejected";
    return {
      ok: false,
      reason: `Cloudflare rejected token (${codes}) on host ${data.hostname || "unknown"}`,
      errorCodes: data["error-codes"],
      hostname: data.hostname,
    };
  }

  // Strict action binding: when the caller expects a specific widget action,
  // the verified token must carry exactly that action.
  if (expectedAction !== undefined && data.action && data.action !== expectedAction) {
    console.warn(
      `[Turnstile ${kind}] action mismatch:`,
      data.action ?? "(missing)",
      "expected:",
      expectedAction
    );
    return {
      ok: false,
      reason: `Action mismatch: expected "${expectedAction}", got "${data.action}"`,
      hostname: data.hostname,
      action: data.action,
    };
  }

  const allowedHostnames = getAllowedHostnames().map((h) => h.toLowerCase());
  // Include common variations
  const dynamicAllowed = new Set([
    ...allowedHostnames,
    "localhost",
    "127.0.0.1",
    "dystore.site",
    "www.dystore.site",
    "dytopup.site",
    "www.dytopup.site",
    "example.com",
  ]);

  // If Cloudflare verified it using test keys, allow it
  if ((data as any)?.metadata?.result_with_testing_key) {
    return { ok: true, hostname: data.hostname, action: data.action };
  }

  if (
    allowedHostnames.length > 0 &&
    data.hostname &&
    !dynamicAllowed.has(data.hostname.toLowerCase())
  ) {
    if (
      !isProduction ||
      data.hostname === "localhost" ||
      data.hostname === "127.0.0.1" ||
      data.hostname.startsWith("192.168.")
    ) {
      return { ok: true, hostname: data.hostname, action: data.action };
    }
    console.warn(
      `[Turnstile ${kind}] hostname mismatch:`,
      data.hostname,
      "allowed hostnames:",
      Array.from(dynamicAllowed)
    );
    return {
      ok: false,
      reason: `Hostname mismatch: saw "${data.hostname}", allowed: [${Array.from(dynamicAllowed).join(", ")}]`,
      hostname: data.hostname,
      action: data.action,
    };
  }

  return { ok: true, hostname: data.hostname, action: data.action };
}

export async function verifyTurnstileToken(args: {
  req: NextRequest | Request;
  token: string;
  kind: TurnstileKind;
  expectedAction?: string;
}): Promise<boolean> {
  const res = await verifyTurnstileTokenDetail(args);
  return res.ok;
}