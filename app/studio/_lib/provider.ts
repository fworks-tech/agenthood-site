import { getProviderApiKeys } from "./env";
import { ProviderUnavailableError } from "./errors";
import { createAnthropicProvider } from "./providers/anthropic";
import { createOpenAIProvider } from "./providers/openai";
import { createGroqProvider } from "./providers/groq";
import { createOpenCodeProvider } from "./providers/opencode";

export type ProviderName = "anthropic" | "openai" | "groq" | "opencode";

export interface ChatConfigParams {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
}

export type StreamingProvider = {
  stream: (systemPrompt: string, messages: { role: string; content: string }[], signal?: AbortSignal, config?: ChatConfigParams) => Promise<ReadableStream>;
};

export function resolveProvider(preferredProvider: string, baseUrl?: string, apiKey?: string): { name: ProviderName; instance: StreamingProvider } {
  const keys = getProviderApiKeys();
  const preferred = preferredProvider as ProviderName;

  if (preferred === "opencode") {
    return { name: "opencode", instance: createOpenCodeProvider(baseUrl ?? "http://localhost:4000", apiKey || undefined) };
  }

  if (keys[preferred]) {
    return { name: preferred, instance: createFromKey(preferred, keys[preferred]!) };
  }

  type KeyNames = keyof typeof keys;
  const fallback = (Object.keys(keys) as KeyNames[]).find((k) => keys[k]);
  if (fallback) return { name: fallback as ProviderName, instance: createFromKey(fallback as ProviderName, keys[fallback]!) };

  throw new ProviderUnavailableError(preferred);
}

function createFromKey(name: ProviderName, apiKey: string): StreamingProvider {
  switch (name) {
    case "anthropic": return createAnthropicProvider(apiKey);
    case "openai": return createOpenAIProvider(apiKey);
    case "groq": return createGroqProvider(apiKey);
    case "opencode": return createOpenCodeProvider("http://localhost:4000", apiKey);
  }
}
