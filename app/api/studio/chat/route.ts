import * as Sentry from "@sentry/nextjs";
import { LightweightAdapter } from "@/app/(main)/studio/_lib/agenthood-adapter";
import { getAgentById } from "@/app/(main)/studio/_data/agents";
import { ValidationError, StudioError } from "@/app/(main)/studio/_lib/errors";
import {
  validateTurnstile,
  createCaptchaCookieValue,
  getCaptchaCookieAttributes,
  parseCaptchaCookie,
} from "@/app/(main)/studio/_lib/captcha";
import { logger } from "@/app/(main)/studio/_lib/logger";
import type { ChatConfig } from "@/app/(main)/studio/_types/studio";
import { PROVIDER_MODELS } from "@/app/(main)/studio/_types/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOTAL_CHARS = 100_000;
const MAX_TOKENS = 100_000;

type ChatRequestConfig = Partial<Pick<ChatConfig, "model" | "temperature" | "maxTokens" | "baseUrl">> & {
  provider?: string;
  apiKey?: string;
  enabledTools?: string[];
};

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const CORRELATION_ID_MAX_LENGTH = 128;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function readCorrelationId(request: Request): string | undefined {
  const raw = request.headers.get("X-Correlation-Id");
  if (raw === null) return undefined;
  const id = raw.trim();
  if (id.length === 0 || id.length > CORRELATION_ID_MAX_LENGTH || CONTROL_CHARS.test(id)) {
    throw new ValidationError("Invalid X-Correlation-Id header");
  }
  return id;
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
const VALID_PROVIDERS = new Set(Object.keys(PROVIDER_MODELS));

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
  if (typeof c.provider === "string") {
    if (!VALID_PROVIDERS.has(c.provider)) {
      throw new ValidationError(`Unknown provider: "${c.provider}"`);
    }
    validated.provider = c.provider;
  }
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
  if (Array.isArray(c.enabledTools)) {
    const validToolNames = new Set(["web_fetch", "code_execution"]);
    validated.enabledTools = (c.enabledTools as unknown[]).filter(
      (t): t is string => typeof t === "string" && validToolNames.has(t),
    );
  }

  if (validated.provider && validated.model) {
    const providerModels =
      PROVIDER_MODELS[validated.provider as keyof typeof PROVIDER_MODELS]?.models ?? [];
    if (!providerModels.some((m) => m.id === validated.model)) {
      throw new ValidationError(`Unknown model "${validated.model}" for provider "${validated.provider}"`);
    }
  }

  return validated;
}

function validateBaseUrl(baseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ValidationError("Invalid baseUrl format");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError("baseUrl must use http or https protocol");
  }
  if (parsed.protocol === "http:") {
    const hostname = parsed.hostname.toLowerCase();
    if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(hostname)) {
      throw new ValidationError("http baseUrl is only allowed for localhost");
    }
  }
}

export async function POST(request: Request) {
  const requestId = generateId();
  let correlationId: string | undefined;
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ValidationError("Request body must be a JSON object");
    }

    correlationId = readCorrelationId(request) ?? requestId;

    const { agentId, messages: rawMessages, config: rawConfig, turnstileToken } = body as Record<string, unknown>;
    const verifiedCookie = parseCaptchaCookie(request.headers.get("cookie"));
    const didVerify = await validateTurnstile(turnstileToken, verifiedCookie);

    if (!agentId || typeof agentId !== "string") throw new ValidationError("agentId must be a string");
    const agent = getAgentById(agentId);
    if (!agent) throw new ValidationError(`Unknown agent: "${agentId}"`);

    const messages = validateMessages(rawMessages);
    const config = validateConfig(rawConfig);

    const adapter = new LightweightAdapter();
    const stream = await adapter.chat({ agentId, messages, config, correlationId }, request.signal);

    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Request-Id": requestId,
      "X-Correlation-Id": correlationId,
    };
    if (didVerify) {
      const cookieValue = await createCaptchaCookieValue();
      headers["Set-Cookie"] = `${"captcha_verified"}=${cookieValue}; ${getCaptchaCookieAttributes()}`;
    }
    const response = new Response(stream, { headers });

    logger.info("chat.request", { agentId, agentName: agent.name, provider: config.provider, model: config.model, messageCount: messages.length, requestId, correlationId });
    return response;
  } catch (err) {
    if (err instanceof StudioError) {
      logger.warn("chat.validation_failed", { code: err.code, message: err.message, requestId, correlationId });
      return Response.json({ error: err.message, code: err.code, requestId, correlationId }, { status: err.statusCode });
    }

    const msg = err instanceof Error ? err.message : String(err);
    logger.error("chat.error", { error: msg, requestId, correlationId });
    if (err instanceof Error) Sentry.captureException(err, { extra: { requestId, correlationId } });
    return Response.json({ error: "Internal server error", code: "INTERNAL_ERROR", requestId, correlationId }, { status: 500 });
  }
}
