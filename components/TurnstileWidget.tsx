"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>
      ) => string;
      reset?: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

type TurnstileKind = "public" | "admin";

export default function TurnstileWidget({
  kind,
  action,
  onVerify,
  onError,
  className,
  size = "normal",
}: {
  kind: TurnstileKind;
  action: string;
  onVerify?: (token: string) => void;
  onError?: () => void;
  className?: string;
  size?: "normal" | "compact" | "invisible";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);

  const siteKey =
    kind === "admin"
      ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_ADMIN
      : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_PUBLIC;

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
  }, [onVerify, onError]);

  useEffect(() => {
    if (!siteKey) return;

    let alive = true;

    function tryRender() {
      if (!alive) return true;
      if (!containerRef.current || !window.turnstile || widgetIdRef.current) {
        return false;
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        size,
        callback: (token: string) => {
          onVerifyRef.current?.(token);
        },
        "expired-callback": () => {
          onVerifyRef.current?.("");
          if (widgetIdRef.current) {
            window.turnstile?.reset?.(widgetIdRef.current);
          }
        },
        "error-callback": () => {
          onVerifyRef.current?.("");
          onErrorRef.current?.();
        },
      });

      return true;
    }

    if (!tryRender()) {
      const timer = window.setInterval(() => {
        if (tryRender()) window.clearInterval(timer);
      }, 150);

      return () => {
        alive = false;
        window.clearInterval(timer);
        if (widgetIdRef.current) {
          window.turnstile?.remove?.(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }

    return () => {
      alive = false;
      if (widgetIdRef.current) {
        window.turnstile?.remove?.(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action, size]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />

      <div ref={containerRef} className={className} />
    </>
  );
}