import type { ChatConfig } from "../_types/studio";

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
  status: "pending" | "complete" | "error";
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
  toolCalls?: ToolCallInfo[];
}

export interface ExecuteToolResponse {
  result?: string;
  error?: string;
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

export async function replayToolExecution(
  tool: string,
  args: Record<string, unknown>,
  turnstileToken?: string,
  correlationId?: string,
): Promise<ExecuteToolResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (correlationId) headers["X-Correlation-Id"] = correlationId;
  const res = await fetch("/api/studio/tools/execute/", {
    method: "POST",
    headers,
    body: JSON.stringify({ tool, args, turnstileToken }),
  });
  if (!res.ok) {
    let errorBody: { error?: string; code?: string } | null = null;
    try {
      errorBody = await res.json();
    } catch {
      /* non-JSON error body */
    }
    const msg = errorBody?.error ?? `Server error: ${res.status}`;
    const err = new Error(msg);
    (err as Error & { code?: string }).code = errorBody?.code;
    throw err;
  }
  return (await res.json()) as ExecuteToolResponse;
}
