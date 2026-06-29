import { LightweightAdapter } from "@/app/(main)/studio/_lib/agenthood-adapter";
import { getAgentById } from "@/app/(main)/studio/_data/agents";
import { ValidationError, StudioError } from "@/app/(main)/studio/_lib/errors";
import { logger } from "@/app/(main)/studio/_lib/logger";
import type { ChatConfig } from "@/app/(main)/studio/_types/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOTAL_CHARS = 100_000;
const MAX_TOKENS = 100_000;

const STUDIO_TOKEN = process.env.STUDIO_API_TOKEN;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type ChatRequestConfig = Partial<Pick<ChatConfig, "model" | "temperature" | "maxTokens" | "baseUrl">> & {
  provider?: string;
  apiKey?: string;
};

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function authGuard(request: Request): void {
  if (!STUDIO_TOKEN) return;
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${STUDIO_TOKEN}`) {
    throw new StudioError("Unauthorized. Provide a valid STUDIO_API_TOKEN.", "UNAUTHORIZED", 401);
  }
}

function validateMessages(messages: unknown): { role: string; content: string }[] {
  if (!Array.isArray(messages)) throw new ValidationError("messages must be an array");
  if (messages.length === 0) throw new ValidationError("messages must not be empty");
  if (messages.length > MAX_MESSAGES) throw new ValidationError(`messages must not exceed ${MAX_MESSAGES} items`);

  let totalChars = 0;
  for (const msg of messages) {
    if (!msg.role || typeof msg.role !== "string") throw new ValidationError("Each message must have a role string");
    if (typeof msg.content !== "string") throw new ValidationError("Each message must have a content string");
    if (msg.content.length > MAX_MESSAGE_LENGTH) throw new ValidationError(`Message content exceeds ${MAX_MESSAGE_LENGTH} characters`);
    totalChars += msg.content.length;
  }

  if (totalChars > MAX_TOTAL_CHARS) throw new ValidationError(`Total message content exceeds ${MAX_TOTAL_CHARS} characters`);

  return (messages as { role: string; content: string }[]);
}

const CLOUD_PROVIDERS = new Set(["anthropic", "openai", "groq"]);

function validateConfig(config: unknown): ChatRequestConfig {
  const validated: ChatRequestConfig = {};
  if (!config || typeof config !== "object") return validated;

  const c = config as Record<string, unknown>;
  if (typeof c.model === "string") validated.model = c.model;
  if (typeof c.temperature === "number" && c.temperature >= 0 && c.temperature <= 2) {
    validated.temperature = c.temperature;
  }
  if (typeof c.maxTokens === "number" && c.maxTokens > 0 && c.maxTokens <= MAX_TOKENS) {
    validated.maxTokens = c.maxTokens;
  }
  if (typeof c.provider === "string") validated.provider = c.provider;
  if (typeof c.baseUrl === "string") {
    if (c.provider && CLOUD_PROVIDERS.has(c.provider as string)) {
      throw new ValidationError(`baseUrl is not supported for ${c.provider}. Use the default API endpoint.`);
    }
    validateBaseUrl(c.baseUrl);
    validated.baseUrl = c.baseUrl;
  }
  if (typeof c.apiKey === "string") {
    validated.apiKey = c.apiKey;
  }

  return validated;
}

function validateBaseUrl(baseUrl: string): void {
  try {
    new URL(baseUrl);
  } catch {
    throw new ValidationError("Invalid baseUrl format");
  }
}

async function validateTurnstile(token: unknown): Promise<void> {
  if (!TURNSTILE_SECRET || !TURNSTILE_SITE_KEY) return;
  if (typeof token !== "string" || !token) {
    throw new ValidationError("Missing CAPTCHA token. Please refresh and try again.");
  }
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token }),
  });
  const data = await res.json() as { success?: boolean };
  if (!data.success) {
    throw new ValidationError("CAPTCHA verification failed. Please refresh and try again.");
  }
}

export async function POST(request: Request) {
  const requestId = generateId();
  try {
    authGuard(request);

    const body = await request.json();
    if (!body || typeof body !== "object") throw new ValidationError("Request body must be a JSON object");

    const { agentId, messages: rawMessages, config: rawConfig, turnstileToken } = body as Record<string, unknown>;
    await validateTurnstile(turnstileToken);

    if (!agentId || typeof agentId !== "string") throw new ValidationError("agentId must be a string");
    const agent = getAgentById(agentId);
    if (!agent) throw new ValidationError(`Unknown agent: "${agentId}"`);

    const messages = validateMessages(rawMessages);
    const config = validateConfig(rawConfig);

    const adapter = new LightweightAdapter();
    const stream = await adapter.chat({ agentId, messages, config }, request.signal);

    const response = new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Request-Id": requestId,
      },
    });

    logger.info("chat.request", { agentId, agentName: agent.name, provider: config.provider, model: config.model, messageCount: messages.length, requestId });
    return response;
  } catch (err) {
    if (err instanceof StudioError) {
      logger.warn("chat.validation_failed", { code: err.code, message: err.message, requestId });
      return Response.json({ error: err.message, code: err.code, requestId }, { status: err.statusCode });
    }

    const msg = err instanceof Error ? err.message : String(err);
    logger.error("chat.error", { error: msg, requestId });
    return Response.json({ error: "Internal server error", code: "INTERNAL_ERROR", requestId }, { status: 500 });
  }
}
