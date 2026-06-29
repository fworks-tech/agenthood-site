import type { AgentEntry } from "../_data/agents";
import type { ChatConfig } from "../_types/studio";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
}

export async function fetchAgents(): Promise<AgentEntry[]> {
  const res = await fetch("/api/studio/agents");
  if (!res.ok) throw new Error("Failed to fetch agents");
  const data = await res.json();
  return data.agents;
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
