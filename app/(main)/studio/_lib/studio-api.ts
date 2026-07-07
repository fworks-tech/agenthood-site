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
  signal?: AbortSignal,
): Promise<Response> {
  return fetch("/api/studio/chat/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, messages, config, turnstileToken }),
    signal,
  });
}
