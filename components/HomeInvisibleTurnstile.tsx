"use client";

import TurnstileWidget from "@/components/TurnstileWidget";

export default function HomeInvisibleTurnstile() {
  async function verifyHomeToken(token: string) {
    if (!token) return;

    try {
      await fetch("/api/turnstile/home", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ turnstileToken: token }),
      });
    } catch {
      // Silent fail: don't block homepage UX
    }
  }

  return (
    <TurnstileWidget
      kind="public"
      action="home_page"
      onVerify={verifyHomeToken}
      onError={() => {
        // Silent fail for homepage
      }}
    />
  );
}