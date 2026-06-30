export type Provider = "anthropic" | "openai" | "groq" | "ollama" | "opencode" | "opencode-go";

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
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (default)" },
      { id: "claude-fable-5", label: "Claude Fable 5" },
      { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
      { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
      { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
      { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
    ],
  },
  openai: {
    label: "OpenAI",
    requiresKey: true,
    requiresBaseUrl: false,
    models: [
      { id: "gpt-4o", label: "GPT-4o (default)" },
      { id: "gpt-5.5", label: "GPT-5.5" },
      { id: "gpt-5.4", label: "GPT-5.4" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
      { id: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
    ],
  },
  groq: {
    label: "Groq",
    requiresKey: true,
    requiresBaseUrl: false,
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
      { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B" },
      { id: "qwen/qwen3-32b", label: "Qwen3 32B" },
      { id: "qwen/qwen3.6-27b", label: "Qwen3.6 27B" },
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
      { id: "deepseek-r1", label: "DeepSeek R1" },
    ],
  },
  opencode: {
    label: "OpenCode Zen",
    requiresKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: "https://opencode.ai/zen/v1",
    models: [
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
      { id: "gpt-5.5", label: "GPT-5.5" },
      { id: "gpt-5.4", label: "GPT-5.4" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
      { id: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
      { id: "claude-fable-5", label: "Claude Fable 5" },
      { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
      { id: "qwen3.7-max", label: "Qwen3.7 Max" },
      { id: "qwen3.7-plus", label: "Qwen3.7 Plus" },
      { id: "glm-5.2", label: "GLM 5.2" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { id: "minimax-m2.7", label: "MiniMax M2.7" },
      { id: "kimi-k2.6", label: "Kimi K2.6" },
      { id: "grok-build-0.1", label: "Grok Build 0.1" },
      { id: "big-pickle", label: "Big Pickle (free)" },
      { id: "deepseek-v4-flash-free", label: "DeepSeek V4 Flash (free)" },
    ],
  },
  "opencode-go": {
    label: "OpenCode Go",
    requiresKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: "https://opencode.ai/zen/go/v1",
    models: [
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
      { id: "mimo-v2.5-pro", label: "MiMo-V2.5-Pro" },
      { id: "mimo-v2.5", label: "MiMo-V2.5" },
      { id: "qwen3.7-max", label: "Qwen3.7 Max" },
      { id: "qwen3.7-plus", label: "Qwen3.7 Plus" },
      { id: "glm-5.2", label: "GLM 5.2" },
      { id: "kimi-k2.7-code", label: "Kimi K2.7 Code" },
      { id: "minimax-m3", label: "MiniMax M3" },
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
  return meta?.models[0]?.id ?? "deepseek-v4-flash";
}
