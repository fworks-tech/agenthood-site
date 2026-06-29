import { getProviderApiKeys } from "./env";
import { ProviderUnavailableError } from "./errors";

export type ProviderName = "anthropic" | "openai" | "groq";

interface ProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface ChatConfigParams {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const PROVIDER_MODELS: Record<ProviderName, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  groq: "llama-3.3-70b-versatile",
};

export type StreamingProvider = {
  stream: (systemPrompt: string, messages: { role: string; content: string }[], signal?: AbortSignal, config?: ChatConfigParams) => Promise<ReadableStream>;
};

function createAnthropicProvider(config: ProviderConfig): StreamingProvider {
  return {
    async stream(systemPrompt, messages, signal, chatConfig) {
      const { Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: config.apiKey });

      const apiMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const stream = await client.messages.stream(
        {
          model: chatConfig?.model ?? config.model ?? PROVIDER_MODELS.anthropic,
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
            if (signal?.aborted) {
              controller.close();
              return;
            }
            const msg = err instanceof Error ? err.message : String(err);
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "error", data: msg }) + "\n"));
          } finally {
            controller.close();
          }
        },
      });
    },
  };
}

function createOpenAIProvider(config: ProviderConfig): StreamingProvider {
  return {
    async stream(systemPrompt, messages, signal, chatConfig) {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });

      const apiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const stream = await client.chat.completions.create(
        {
          model: chatConfig?.model ?? config.model ?? PROVIDER_MODELS.openai,
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
            if (signal?.aborted) {
              controller.close();
              return;
            }
            const msg = err instanceof Error ? err.message : String(err);
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "error", data: msg }) + "\n"));
          } finally {
            controller.close();
          }
        },
      });
    },
  };
}

function createGroqProvider(config: ProviderConfig): StreamingProvider {
  return createOpenAIProvider({ ...config, baseUrl: config.baseUrl ?? "https://api.groq.com/openai/v1" });
}

export function resolveProvider(preferredProvider: string): { name: ProviderName; instance: StreamingProvider } {
  const keys = getProviderApiKeys();
  const preferred = preferredProvider as ProviderName;

  const providerMap: [ProviderName, string | undefined, () => StreamingProvider][] = [
    [preferred, keys[preferred] || undefined, () => createProviderInstance(preferred, keys[preferred]!)],
  ];

  for (const [name] of providerMap) {
    if (name === preferred) continue;
    const key = keys[name];
    if (key) {
      providerMap.push([name, key, () => createProviderInstance(name, key)]);
    }
  }

  for (const [name, key, factory] of providerMap) {
    if (key) {
      return { name, instance: factory() };
    }
  }

  throw new ProviderUnavailableError(preferred);
}

function createProviderInstance(name: ProviderName, apiKey: string): StreamingProvider {
  switch (name) {
    case "anthropic":
      return createAnthropicProvider({ apiKey });
    case "openai":
      return createOpenAIProvider({ apiKey });
    case "groq":
      return createGroqProvider({ apiKey });
  }
}
