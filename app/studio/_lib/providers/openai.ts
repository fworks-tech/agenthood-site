import type { StreamingProvider } from "../provider";

export function createOpenAIProvider(apiKey: string, baseUrl?: string): StreamingProvider {
  return {
    async stream(systemPrompt, messages, signal, chatConfig) {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey, baseURL: baseUrl });

      const apiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const stream = await client.chat.completions.create(
        {
          model: chatConfig?.model ?? "gpt-4o",
          messages: apiMessages,
          stream: true,
          max_tokens: chatConfig?.maxTokens ?? 4096,
          temperature: chatConfig?.temperature,
        },
        { signal },
      );

      return new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "token", data: delta }) + "\n"));
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
