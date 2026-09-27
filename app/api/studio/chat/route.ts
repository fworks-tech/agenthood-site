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
import { generateId } from "@/app/(main)/studio/_lib/ids";
import { BUILT_IN_TOOL_NAMES } from "@/app/(main)/studio/_lib/tools";
import { DEMO_PROVIDER } from "@/app/(main)/studio/_types/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOTAL_CHARS = 100_000;

// Provider, model, key, base URL, temperature, and max tokens are all pinned
// server-side — the Studio is a zero-setup demo. Only tool selection is client-
// controlled, and only against this allowlist.
// Silent drop (not reject) avoids leaking which providers/models exist and is
// the correct defensive posture for a public demo endpoint.
type ChatRequestConfig = { enabledTools?: string[] };

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

const CUSTOM_TOOL_PATTERN = /^custom_[a-z][a-z0-9_]{0,56}$/;

// Shape validation only. The identity grant (which tools this member may use)
// is enforced once, in the adapter — the single choke point every caller of
// provider.complete() shares — so it cannot be bypassed by a crafted body and
// cannot drift out of sync with getMemberTools().
function validateConfig(config: unknown): ChatRequestConfig {
  const validated: ChatRequestConfig = {};
  if (!config || typeof config !== "object") return validated;

  const c = config as Record<string, unknown>;
  if (Array.isArray(c.enabledTools)) {
    validated.enabledTools = (c.enabledTools as unknown[]).filter(
      (t): t is string =>
        typeof t === "string" &&
        (CUSTOM_TOOL_PATTERN.test(t) || BUILT_IN_TOOL_NAMES.has(t)),
    );
  }

  return validated;
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

    // No model field: the tier is selected in the adapter per request —
    // the adapter trace is the source of truth for which model ran.
    logger.info("chat.request", { agentId, agentName: agent.name, provider: DEMO_PROVIDER, messageCount: messages.length, requestId, correlationId });
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
