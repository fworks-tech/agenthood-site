"use client";

import { useRef, useEffect, useCallback } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback": () => void;
        "error-callback": () => void;
        "timeout-callback": () => void;
        theme?: "light" | "dark" | "auto";
      }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const MAX_RETRIES = 2;

interface TurnstileProps {
  onToken: (token: string | null) => void;
  onError?: (error: string) => void;
  refreshKey?: number;
}

export default function Turnstile({ onToken, onError, refreshKey }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);

  const handleToken = useCallback((token: string | null) => {
    retryCountRef.current = 0;
    onToken(token);
  }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current || typeof window === "undefined") return;

    const id = "turnstile-" + Math.random().toString(36).slice(2, 9);

    function render() {
      if (!window.turnstile || !containerRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => handleToken(token),
        "expired-callback": () => handleToken(null),
        "error-callback": () => {
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++;
            if (widgetIdRef.current && window.turnstile) {
              window.turnstile.reset(widgetIdRef.current);
            }
          } else {
            handleToken(null);
            onError?.("CAPTCHA failed to load. Please refresh the page.");
          }
        },
        "timeout-callback": () => {
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++;
            if (widgetIdRef.current && window.turnstile) {
              window.turnstile.reset(widgetIdRef.current);
            }
          } else {
            handleToken(null);
            onError?.("CAPTCHA verification timed out. Please refresh the page.");
          }
        },
        theme: "dark",
      });
    }

    containerRef.current.id = id;

    if (window.turnstile) {
      render();
    } else {
      window.onloadTurnstileCallback = render;
      if (!document.querySelector('script[src*="turnstile"]')) {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit";
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          handleToken(null);
          onError?.("Failed to load CAPTCHA script. Please disable your ad blocker and refresh.");
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [handleToken, onError]);

  useEffect(() => {
    if (refreshKey === undefined || refreshKey === 0) return;
    if (!window.turnstile || !widgetIdRef.current) return;
    retryCountRef.current = 0;
    window.turnstile.reset(widgetIdRef.current);
    onToken(null);
  }, [refreshKey, onToken]);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className="turnstile-widget" style={{ position: "fixed", opacity: 0, pointerEvents: "none", zIndex: -1 }} />;
}
