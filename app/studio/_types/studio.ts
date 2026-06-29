export type Provider = "anthropic" | "openai" | "groq" | "ollama" | "opencode";

export interface ChatConfig {
  provider: Provider;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface ProviderMeta {
  label: string;
  requiresKey: boolean;
  requiresBaseUrl: boolean;
  defaultBaseUrl?: string;
  models: Array<{ id: string; label: string }>;
}

export type ProviderModelsMap = Record<Provider, ProviderMeta>;

export const PROVIDER_MODELS: ProviderModelsMap = {
  anthropic: {
    label: "Anthropic",
    requiresKey: true,
    requiresBaseUrl: false,
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
      { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
    ],
  },
  openai: {
    label: "OpenAI",
    requiresKey: true,
    requiresBaseUrl: false,
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
  },
  groq: {
    label: "Groq",
    requiresKey: true,
    requiresBaseUrl: false,
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
      { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
    ],
  },
  ollama: {
    label: "Ollama (local)",
    requiresKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434",
    models: [
      { id: "llama3.2", label: "Llama 3.2" },
      { id: "llama3.1", label: "Llama 3.1" },
      { id: "mistral", label: "Mistral 7B" },
      { id: "codellama", label: "Code Llama" },
      { id: "phi3", label: "Phi-3" },
      { id: "gemma2", label: "Gemma 2" },
      { id: "qwen2.5-coder", label: "Qwen 2.5 Coder" },
    ],
  },
  opencode: {
    label: "OpenCode",
    requiresKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: "http://localhost:4000",
    models: [
      { id: "opencode-1", label: "OpenCode 1" },
      { id: "opencode-1-mini", label: "OpenCode 1 Mini" },
    ],
  },
};

export const CODE_AGENTS = new Set([
  "the-architect",
  "the-reviewer",
  "the-tester",
  "the-debugger",
  "the-warden",
]);

export function getProviderMeta(provider: Provider): ProviderMeta {
  return PROVIDER_MODELS[provider];
}

export function getDefaultModel(provider: Provider): string {
  const meta = PROVIDER_MODELS[provider];
  return meta?.models[0]?.id ?? "claude-sonnet-4-20250514";
}
