import { LightweightAdapter } from "@/app/studio/_lib/agenthood-adapter";
import { getAgentById } from "@/app/studio/_data/agents";
import { ValidationError, StudioError } from "@/app/studio/_lib/errors";
import { logger } from "@/app/studio/_lib/logger";
import type { ChatConfig } from "@/app/studio/_types/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOTAL_CHARS = 100_000;
const MAX_TOKENS = 100_000;

const STUDIO_TOKEN = process.env.STUDIO_API_TOKEN;

type ChatRequestConfig = Partial<Pick<ChatConfig, "model" | "temperature" | "maxTokens" | "baseUrl">> & {
  provider?: string;
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
    validateBaseUrl(c.baseUrl);
    validated.baseUrl = c.baseUrl;
  }

  return validated;
}

function validateBaseUrl(baseUrl: string): void {
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname.replace(/^\[(.+)\]$/, "$1");
    const allowed = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
    if (!allowed.has(hostname)) {
      throw new ValidationError("Only localhost endpoints are allowed for self-hosted providers");
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("Invalid baseUrl format");
  }
}

export async function POST(request: Request) {
  const requestId = generateId();
  try {
    authGuard(request);

    const body = await request.json();
    if (!body || typeof body !== "object") throw new ValidationError("Request body must be a JSON object");

    const { agentId, messages: rawMessages, config: rawConfig } = body as Record<string, unknown>;

    if (!agentId || typeof agentId !== "string") throw new ValidationError("agentId must be a string");
    if (!getAgentById(agentId)) throw new ValidationError(`Unknown agent: "${agentId}"`);

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

    logger.info("chat.request", { agentId, provider: config.provider, messageCount: messages.length, requestId });
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
