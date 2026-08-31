import * as Sentry from "@sentry/nextjs";
import { ValidationError, StudioError } from "@/app/(main)/studio/_lib/errors";
import {
  validateTurnstile,
  createCaptchaCookieValue,
  getCaptchaCookieAttributes,
  parseCaptchaCookie,
} from "@/app/(main)/studio/_lib/captcha";
import { executeTool, classifyToolResult } from "@/app/(main)/studio/_lib/tools";
import { logger } from "@/app/(main)/studio/_lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VALID_TOOLS = new Set(["web_fetch", "code_execution"]);
const MAX_ARGS_CHARS = 100_000;
const CORRELATION_ID_MAX_LENGTH = 128;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readCorrelationId(request: Request): string | undefined {
  const raw = request.headers.get("X-Correlation-Id");
  if (raw === null) return undefined;
  const id = raw.trim();
  if (id.length === 0 || id.length > CORRELATION_ID_MAX_LENGTH || CONTROL_CHARS.test(id)) {
    throw new ValidationError("Invalid X-Correlation-Id header");
  }
  return id;
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

    const { tool, args, turnstileToken } = body as Record<string, unknown>;
    const verifiedCookie = parseCaptchaCookie(request.headers.get("cookie"));
    const didVerify = await validateTurnstile(turnstileToken, verifiedCookie);

    if (typeof tool !== "string" || !VALID_TOOLS.has(tool)) {
      throw new ValidationError(`Unknown tool: "${tool ?? "undefined"}"`);
    }
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      throw new ValidationError("args must be a JSON object");
    }
    if (JSON.stringify(args).length > MAX_ARGS_CHARS) {
      throw new ValidationError(`args exceed ${MAX_ARGS_CHARS} characters`);
    }

    const result = await executeTool(tool, args as Record<string, unknown>, request.signal);
    const outcome = classifyToolResult(result);

    logger.info("tools.execute", { tool, requestId, correlationId, ok: !outcome.error });
    const headers: Record<string, string> = {
      "X-Request-Id": requestId,
      "X-Correlation-Id": correlationId,
    };
    if (didVerify) {
      const cookieValue = await createCaptchaCookieValue();
      headers["Set-Cookie"] = `captcha_verified=${cookieValue}; ${getCaptchaCookieAttributes()}`;
    }
    return Response.json({ ...outcome, requestId, correlationId }, { status: 200, headers });
  } catch (err) {
    if (err instanceof StudioError) {
      logger.warn("tools.validation_failed", { code: err.code, message: err.message, requestId, correlationId });
      return Response.json({ error: err.message, code: err.code, requestId, correlationId }, { status: err.statusCode });
    }

    const msg = err instanceof Error ? err.message : String(err);
    logger.error("tools.error", { error: msg, requestId, correlationId });
    if (err instanceof Error) Sentry.captureException(err, { extra: { requestId, correlationId } });
    return Response.json({ error: "Internal server error", code: "INTERNAL_ERROR", requestId, correlationId }, { status: 500 });
  }
}
