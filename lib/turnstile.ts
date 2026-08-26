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
  if (kind === "admin") return process.env.TURNSTILE_SECRET_KEY_ADMIN;
  return process.env.TURNSTILE_SECRET_KEY_PUBLIC;
}

function getAllowedHostnames() {
  return (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

export async function verifyTurnstileToken({
  req,
  token,
  kind,
  expectedAction,
}: {
  req: NextRequest | Request;
  token: string;
  kind: TurnstileKind;
  expectedAction: string;
}) {
  const secret = getSecret(kind);

  if (!secret || !token) {
    return false;
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  const ip = getClientIp(req);
  if (ip) formData.append("remoteip", ip);

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
    }
  );

  if (!res.ok) return false;

  const data = (await res.json()) as TurnstileResponse;

  if (!data.success) {
    console.warn("Turnstile failed:", data["error-codes"]);
    return false;
  }

  if (data.action && data.action !== expectedAction) {
    console.warn("Turnstile action mismatch:", data.action);
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