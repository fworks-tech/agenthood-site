import type { ChatConfig } from "../_types/studio";

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
  status: "pending" | "complete" | "error";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
  toolCalls?: ToolCallInfo[];
}

export async function sendChat(
  agentId: string,
  messages: { role: string; content: string }[],
  config: Partial<ChatConfig>,
  turnstileToken?: string,
  correlationId?: string,
  signal?: AbortSignal,
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (correlationId) headers["X-Correlation-Id"] = correlationId;
  return fetch("/api/studio/chat/", {
    method: "POST",
    headers,
    body: JSON.stringify({ agentId, messages, config, turnstileToken }),
    signal,
  });
}
