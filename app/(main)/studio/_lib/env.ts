export class EnvError extends Error {
  constructor(key: string) {
    super(`Missing required environment variable: ${key}. Configure it in Vercel environment variables.`);
    this.name = "EnvError";
  }
}

export function getProviderApiKeys(): {
  anthropic: string | undefined;
  openai: string | undefined;
  groq: string | undefined;
} {
  return {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    groq: process.env.GROQ_API_KEY,
  };
}

export function getMaxTokens(): number {
  const val = process.env.AGENTHOOD_MAX_TOKENS;
  if (val) {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 4096;
}

export function getRateLimit(endpoint: string): number {
  const defaults: Record<string, number> = {
    chat: 20,
    agents: 60,
    status: 30,
  };
  const envKey = `AGENTHOOD_RATE_LIMIT_${endpoint.toUpperCase()}`;
  const val = process.env[envKey];
  if (val) {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return defaults[endpoint] ?? 30;
}

export function hasAnyApiKey(): boolean {
  const keys = getProviderApiKeys();
  return !!(keys.anthropic || keys.openai || keys.groq);
}
