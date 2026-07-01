"use client";

import { useState, useEffect, useMemo } from "react";
import HelpTip from "./HelpTip";

interface OllamaConnectivityCheckProps {
  baseUrl: string;
}

function isValidOllamaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (parsed.protocol === "https:") return true;
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "host.docker.internal";
  } catch {
    return false;
  }
}

export default function OllamaConnectivityCheck({ baseUrl }: OllamaConnectivityCheckProps) {
  const [status, setStatus] = useState<"checking" | "connected" | "disconnected" | "invalid">("checking");
  const validUrl = useMemo(() => isValidOllamaUrl(baseUrl), [baseUrl]);

  useEffect(() => {
    if (!validUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("invalid");
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (!cancelled) setStatus(res.ok ? "connected" : "disconnected");
      } catch {
        if (!cancelled) setStatus("disconnected");
      }
    }

    check();
    return () => { cancelled = true; };
  }, [baseUrl, validUrl]);

  if (status === "invalid") {
    return (
      <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
        <div className="flex items-start gap-2">
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="flex items-center gap-1 text-xs font-medium text-amber-300">
            Invalid Ollama URL — only http://localhost, http://127.0.0.1, and https:// URLs are allowed.
          </p>
        </div>
      </section>
    );
  }

  if (status === "checking") {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Checking Ollama connection...
          <HelpTip text="Verifies that your local Ollama instance is reachable before sending requests." />
        </div>
      </section>
    );
  }

  if (status === "connected") {
    return (
      <section className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Ollama connected at {baseUrl}
          <HelpTip text="Ollama is reachable and ready. Requests will be sent to your local instance." />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
      <div className="flex items-start gap-2">
        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1">
          <p className="flex items-center gap-1 text-xs font-medium text-amber-300">
            Ollama not detected
            <HelpTip text="If disconnected, ensure Ollama is running and the Base URL above is correct." />
          </p>
          <p className="mt-0.5 text-xs text-amber-500/70">
            Make sure Ollama is running at {baseUrl}.&nbsp;
            <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-400">
              Download Ollama
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
