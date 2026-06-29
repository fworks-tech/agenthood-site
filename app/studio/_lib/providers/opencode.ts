import type { StreamingProvider } from "../provider";

export function createOpenCodeProvider(baseUrl: string, apiKey?: string): StreamingProvider {
  return {
    async stream(systemPrompt, messages, signal, chatConfig) {
      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: chatConfig?.model ?? "opencode-1",
          messages: apiMessages,
          temperature: chatConfig?.temperature,
          max_tokens: chatConfig?.maxTokens ?? 4096,
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`OpenCode request failed: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("OpenCode response body is not readable");

      return new ReadableStream({
        async start(controller) {
          const decoder = new TextDecoder();
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;
                const data = trimmed.slice(6);
                if (data === "[DONE]") {
                  controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "done" }) + "\n"));
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) {
                    controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "token", data: delta }) + "\n"));
                  }
                } catch { continue; }
              }
            }
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "done" }) + "\n"));
          } catch (err) {
            if (signal?.aborted) { controller.close(); return; }
            const msg = err instanceof Error ? err.message : String(err);
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "error", data: msg }) + "\n"));
          } finally { controller.close(); reader.releaseLock(); }
        },
      });
    },
  };
}
