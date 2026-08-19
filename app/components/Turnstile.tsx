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
  /** Render the widget as an interactive element (playground). Defaults to the
   * original invisible placement so shared consumers (news comment form) are unaffected. */
  visible?: boolean;
}

export default function Turnstile({ onToken, onError, refreshKey, visible = false }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);

  // Keep latest callbacks in refs so Turnstile's browser callbacks never read stale props,
  // while the widget render effect below stays stable (runs once on mount).
  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  });

  const handleToken = useCallback((token: string | null) => {
    retryCountRef.current = 0;
    onTokenRef.current(token);
  }, []);

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
            onErrorRef.current?.("CAPTCHA failed to load. Please refresh the page.");
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
            onErrorRef.current?.("CAPTCHA verification timed out. Please refresh the page.");
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
          onErrorRef.current?.("Failed to load CAPTCHA script. Please disable your ad blocker and refresh.");
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [handleToken]);

  useEffect(() => {
    if (refreshKey === undefined || refreshKey === 0) return;
    if (!window.turnstile || !widgetIdRef.current) return;
    retryCountRef.current = 0;
    window.turnstile.reset(widgetIdRef.current);
    onTokenRef.current(null);
  }, [refreshKey]);

  if (!SITE_KEY) return null;

  return (
    <div
      ref={containerRef}
      className={
        visible
          ? // Bottom-left clears the composer's send control and the mobile bottom bar;
            // z-40 stays above page content but below Mantine overlays (drawers/sheets).
            "turnstile-widget fixed bottom-16 left-3 z-40 md:bottom-4 md:left-4"
          : "turnstile-widget"
      }
      style={
        visible
          ? { opacity: 1, pointerEvents: "auto" }
          : { position: "fixed", opacity: 0, pointerEvents: "none", zIndex: -1 }
      }
    />
  );
}
