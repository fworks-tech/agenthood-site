export interface ChatConfig {
  provider: "anthropic" | "openai" | "groq";
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export const DEFAULT_CONFIG: Omit<ChatConfig, "systemPrompt"> = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  temperature: 0.7,
  maxTokens: 4096,
};

export const PROVIDER_MODELS: Record<string, string[]> = {
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-latest",
    "claude-3-haiku-20240307",
  ],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
  ],
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
  ],
};

export function getDefaultModel(provider: string): string {
  const models = PROVIDER_MODELS[provider];
  return models?.[0] ?? "claude-sonnet-4-20250514";
}
