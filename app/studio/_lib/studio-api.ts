import type { ChatConfig } from "../_types/studio";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
}

export async function sendChat(
  agentId: string,
  messages: { role: string; content: string }[],
  config: Partial<ChatConfig>,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch("/api/studio/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, messages, config }),
    signal,
  });
}
