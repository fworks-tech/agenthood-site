import type { StreamingProvider } from "../provider";

export function createAnthropicProvider(apiKey: string): StreamingProvider {
  return {
    async stream(systemPrompt, messages, signal, chatConfig) {
      const { Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });

      const apiMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const stream = await client.messages.stream(
        {
          model: chatConfig?.model ?? "claude-sonnet-4-20250514",
          system: systemPrompt,
          max_tokens: chatConfig?.maxTokens ?? 4096,
          temperature: chatConfig?.temperature,
          messages: apiMessages as { role: "user" | "assistant"; content: string }[],
        },
        { signal },
      );

      return new ReadableStream({
        async start(controller) {
          try {
            for await (const event of stream) {
              if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "token", data: event.delta.text }) + "\n"));
              }
            }
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "done" }) + "\n"));
          } catch (err) {
            if (signal?.aborted) { controller.close(); return; }
            const msg = err instanceof Error ? err.message : String(err);
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "error", data: msg }) + "\n"));
          } finally { controller.close(); }
        },
      });
    },
  };
}
