export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
  onToolCall?: (toolCall: { id: string; name: string; args: Record<string, unknown> }) => void;
  onToolResult?: (toolResult: { id: string; name: string; result: string; error?: string }) => void;
}

export async function readSSEStream(
  response: Response,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("Response body is not readable"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  let doneCalled = false;
  const safeOnDone = () => {
    if (!doneCalled) {
      doneCalled = true;
      callbacks.onDone();
    }
  };

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let event: { type: string; [key: string]: unknown } | null;
        try {
          event = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (!event) continue;

        switch (event.type) {
          case "token":
            callbacks.onToken(event.data as string);
            break;
          case "tool_call":
            callbacks.onToolCall?.({ id: event.id as string, name: event.name as string, args: event.args as Record<string, unknown> });
            break;
          case "tool_result":
            callbacks.onToolResult?.({ id: event.id as string, name: event.name as string, result: event.result as string, error: event.error as string | undefined });
            break;
          case "done":
            safeOnDone();
            return;
          case "error":
            callbacks.onError(new Error(event.data as string));
            return;
        }
      }
    }
    safeOnDone();
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
  }
}
