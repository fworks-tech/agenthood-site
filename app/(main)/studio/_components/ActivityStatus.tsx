"use client";

import { Text } from "@mantine/core";

interface ToolLike {
  name: string;
  status: string;
  args?: Record<string, unknown>;
}

export function chatStatusLabel(
  streaming: boolean | undefined,
  toolCalls?: ToolLike[],
  fallback: string | null = "Thinking",
): string | null {
  if (!streaming) return null;
  if (fallback === null && !toolCalls?.length) return null;
  const pending = toolCalls?.find((t) => t.status !== "complete" && t.status !== "error");
  if (pending) {
    if (pending.name === "web_fetch") {
      const url = pending.args?.url as string | undefined;
      let host = "";
      try { host = url ? new URL(url).hostname : ""; } catch { host = ""; }
      // cap an unbroken model-proposed hostname so xs text can't blow out narrow bubbles
      return host ? `Fetching ${host.slice(0, 60)}` : "Fetching URL";
    }
    if (pending.name === "code_execution") return "Running code";
    if ((pending.name ?? "").startsWith("custom_")) return "Running custom tool";
    return "Exploring";
  }
  return fallback;
}

export default function ActivityStatus({ text, tone = "emerald" }: { text: string | null; tone?: "emerald" | "zinc" }) {
  if (!text) return null;
  return (
    <span className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
      <span className="inline-flex gap-1">
        <span
          className={`h-1.5 w-1.5 animate-bounce rounded-full ${tone === "emerald" ? "bg-emerald-400" : "bg-zinc-500"}`}
          style={{ animationDelay: "0ms" }}
        />
        <span
          className={`h-1.5 w-1.5 animate-bounce rounded-full ${tone === "emerald" ? "bg-emerald-400" : "bg-zinc-500"}`}
          style={{ animationDelay: "150ms" }}
        />
        <span
          className={`h-1.5 w-1.5 animate-bounce rounded-full ${tone === "emerald" ? "bg-emerald-400" : "bg-zinc-500"}`}
          style={{ animationDelay: "300ms" }}
        />
      </span>
      <Text c="dimmed" size="xs" className="[overflow-wrap:anywhere]">{text}</Text>
    </span>
  );
}
