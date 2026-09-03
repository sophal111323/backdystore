import { NextRequest } from "next/server";

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

export async function verifyTurnstileToken({
  req,
  token,
  kind,
  expectedAction,
}: {
  req: NextRequest | Request;
  token: string;
  kind: TurnstileKind;
  expectedAction?: string;
}): Promise<boolean> {
  // Fail closed: a missing/empty token is never valid in ANY environment.
  // This check runs before every dev-mode bypass below so an omitted token
  // can never reach the credential checks sitting behind this gate.
  if (typeof token !== "string" || token.trim().length === 0) {
    return false;
  }

  const isProduction = process.env.NODE_ENV === "production";

  // Cloudflare test tokens are honored outside production only. In
  // production they are attacker-known constants and must be rejected.
  if (
    token === CLOUDFLARE_TEST_TOKEN ||
    token.startsWith(CLOUDFLARE_TEST_TOKEN_PREFIX)
  ) {
    if (!isProduction) return true;
    console.warn("Turnstile: rejected Cloudflare test token in production");
    return false;
  }

  const secret = getSecret(kind);

  // Without a secret the token cannot actually be verified: allow only as a
  // local development convenience; production always fails closed here.
  if (!secret) {
    if (!isProduction) {
      console.warn(
        "Turnstile: secret key not configured — accepting token in development only"
      );
      return true;
    }
    return false;
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  const ip = getClientIp(req);
  if (ip) formData.append("remoteip", ip);

  let data: TurnstileResponse;

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      }
    );

    if (!res.ok) return false;

    data = (await res.json()) as TurnstileResponse;
  } catch (error) {
    // Verification servers being unreachable must fail closed with a clear
    // 403 at the call site, not escape as an unhandled 500.
    console.warn("Turnstile siteverify request failed:", error);
    return false;
  }

  if (!data.success) {
    console.warn("Turnstile failed:", data["error-codes"]);
    return false;
  }

  // Strict action binding: when the caller expects a specific widget action,
  // the verified token must carry exactly that action. All widgets in this
  // app set an action, so a mismatch (or missing action) means the token
  // was minted by a different widget/flow and must be rejected.
  if (expectedAction !== undefined && data.action !== expectedAction) {
    console.warn(
      "Turnstile action mismatch:",
      data.action ?? "(missing)",
      "expected:",
      expectedAction
    );
    return false;
  }

  const allowedHostnames = getAllowedHostnames();
  if (
    allowedHostnames.length > 0 &&
    data.hostname &&
    !allowedHostnames.includes(data.hostname)
  ) {
    console.warn("Turnstile hostname mismatch:", data.hostname);
    return false;
  }

  return true;
}