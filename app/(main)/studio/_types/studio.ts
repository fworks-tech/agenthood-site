export type Provider = "anthropic" | "openai" | "groq" | "ollama" | "opencode" | "opencode-go" | "openrouter";

export interface ChatConfig {
  /** @deprecated Pinned server-side to DEMO_PROVIDER. Kept for localStorage migration. */
  provider: Provider;
  /** @deprecated Pinned server-side to DEMO_MODEL. Kept for localStorage migration. */
  model: string;
  /** @deprecated Pinned server-side to 0.7. Kept for localStorage migration. */
  temperature: number;
  /** @deprecated Pinned server-side to DEMO_MAX_TOKENS. Kept for localStorage migration. */
  maxTokens: number;
  systemPrompt: string;
  /** @deprecated No longer set by clients; server never uses it. Kept for localStorage migration. */
  baseUrl?: string;
  /** @deprecated No longer set by clients; server never uses it. Kept for localStorage migration. */
  apiKey?: string;
  enabledTools?: string[];
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
      { id: "gpt-6-luna", label: "GPT-6 Luna" },
      { id: "gpt-5.5", label: "GPT-5.5" },
      { id: "gpt-5.4", label: "GPT-5.4" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
      { id: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
      { id: "gpt-5-nano", label: "GPT-5 Nano (default)" },
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
    defaultBaseUrl: "https://opencode.ai/zen/v1",
    models: [
      { id: "mimo-v2.5", label: "MiMo-V2.5 (default)" },
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
      { id: "mimo-v2.5-pro", label: "MiMo-V2.5-Pro" },
      { id: "qwen3.7-max", label: "Qwen3.7 Max" },
      { id: "qwen3.7-plus", label: "Qwen3.7 Plus" },
      { id: "glm-5.2", label: "GLM 5.2" },
      { id: "kimi-k2.7-code", label: "Kimi K2.7 Code" },
      { id: "minimax-m3", label: "MiniMax M3" },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    requiresKey: true,
    requiresBaseUrl: false,
    models: [
      { id: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini (default)" },
      { id: "openai/gpt-4o", label: "OpenAI GPT-4o" },
      { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
      { id: "google/gemini-3-flash", label: "Gemini 3 Flash" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    ],
  },
};

// The Studio is a zero-setup demo: one provider, one cheap model, enforced
// server-side. Clients cannot override these — the chat route drops provider,
// model, key, and base URL from the request body before the adapter sees it.
export const DEMO_PROVIDER: Provider = "opencode";
export const DEMO_MODEL = "gpt-5-nano";
// Output cap (abuse guard): input bounded by route (50 msgs / 4k chars / 100k total)
// and rate-limited to 20 req/min ⇒ output was the only open dimension.
// 20 req/min × 16,384 tokens = 327,680 tokens/min ≈ $0.13/min on gpt-5-nano.
export const DEMO_MAX_TOKENS = 16384;

export const CODE_AGENTS = new Set([
  "the-architect",
  "the-reviewer",
  "the-tester",
  "the-debugger",
  "the-warden",
]);

// Tiered demo models: the single pin became a 3-tier map. Selection is a pure
// heuristic (no LLM call) enforced server-side in the adapter. All three are
// chat-completions models on the pinned provider — jev-1.13 was rejected here
// because it is a System One decision model on /v1/systemone, not prose chat.
// - Q&A (no tools, no code): gpt-6-luna — $0.10 in / $0.50 out per 1M,
//   cheapest non-free chat model in the console.
// - Default (tools on): gpt-5-nano — $0.05 / $0.40 per 1M.
// - Code (code agent or ``` fences): deepseek-v4-flash — $0.14 / $0.28 per 1M.
// Worst case stays bounded: 20 req/min × 16,384 tokens per response.
export const DEMO_QA_MODEL = "gpt-6-luna";
export const DEMO_CODE_MODEL = "deepseek-v4-flash";

export function selectDemoModel(
  agentId: string,
  messages: { content: string }[],
  toolsOn: boolean,
): string {
  const hasCode = messages.some((m) => m.content.includes("```"));
  if (CODE_AGENTS.has(agentId) || hasCode) return DEMO_CODE_MODEL;
  if (!toolsOn) return DEMO_QA_MODEL;
  return DEMO_MODEL;
}

export function getProviderMeta(provider: Provider): ProviderMeta {
  return PROVIDER_MODELS[provider];
}

export function getDefaultModel(provider: Provider): string {
  const meta = PROVIDER_MODELS[provider];
  return meta?.models[0]?.id ?? "deepseek-v4-flash";
}
