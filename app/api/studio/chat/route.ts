import { LightweightAdapter } from "@/app/studio/_lib/agenthood-adapter";
import { getAgentById } from "@/app/studio/_data/agents";
import { ValidationError, StudioError } from "@/app/studio/_lib/errors";
import { logger } from "@/app/studio/_lib/logger";
import type { ChatConfigParams } from "@/app/studio/_lib/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOTAL_CHARS = 100_000;

function validateRequest(body: unknown): { agentId: string; messages: { role: string; content: string }[]; config?: ChatConfigParams } {
  if (!body || typeof body !== "object") throw new ValidationError("Request body must be a JSON object");

  const { agentId, messages, config } = body as Record<string, unknown>;

  if (!agentId || typeof agentId !== "string") throw new ValidationError("agentId must be a string");
  if (!getAgentById(agentId)) throw new ValidationError(`Unknown agent: "${agentId}"`);

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

  const validatedConfig: ChatConfigParams = {};
  if (config && typeof config === "object") {
    const c = config as Record<string, unknown>;
    if (typeof c.model === "string") validatedConfig.model = c.model;
    if (typeof c.temperature === "number" && c.temperature >= 0 && c.temperature <= 2) {
      validatedConfig.temperature = c.temperature;
    }
    if (typeof c.maxTokens === "number" && c.maxTokens > 0) {
      validatedConfig.maxTokens = c.maxTokens;
    }
  }

  return { agentId, messages: messages.map((m: Record<string, unknown>) => ({ role: m.role as string, content: m.content as string })), config: validatedConfig };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, messages, config } = validateRequest(body);

    const adapter = new LightweightAdapter();
    const stream = await adapter.chat({ agentId, messages, config }, request.signal);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    if (err instanceof StudioError) {
      logger.warn("chat.validation_failed", { code: err.code, message: err.message });
      return Response.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }

    const msg = err instanceof Error ? err.message : String(err);
    logger.error("chat.error", { error: msg });
    return Response.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
