import { createOpenAIProvider } from "./openai";

export function createGroqProvider(apiKey: string): ReturnType<typeof createOpenAIProvider> {
  return createOpenAIProvider(apiKey, "https://api.groq.com/openai/v1");
}
