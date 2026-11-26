import { logger } from "@/app/_lib/studio-server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messageId, value } = body;

    if (!messageId || typeof messageId !== "string" || messageId.length > 256) {
      logger.warn("feedback.validation_failed", { error: "missing messageId" });
      return Response.json({ error: "messageId is required" }, { status: 400 });
    }

    if (value !== "up" && value !== "down" && value !== null) {
      logger.warn("feedback.validation_failed", { error: "invalid value", value });
      return Response.json({ error: "value must be 'up', 'down', or null" }, { status: 400 });
    }

    const optionalFields = {
      conversationId: body.conversationId,
      agentId: body.agentId,
      provider: body.provider,
      model: body.model,
    } as Record<string, unknown>;
    for (const [key, val] of Object.entries(optionalFields)) {
      if (val !== undefined && (typeof val !== "string" || val.length > 256)) {
        logger.warn("feedback.validation_failed", { error: `invalid ${key}` });
        return Response.json({ error: `${key} must be a string of at most 256 chars` }, { status: 400 });
      }
    }

    logger.info("feedback.received", {
      messageId,
      conversationId: (body.conversationId as string | undefined) ?? undefined,
      value,
      ...(body.agentId ? { agentId: body.agentId } : {}),
      ...(body.provider ? { provider: body.provider } : {}),
      ...(body.model ? { model: body.model } : {}),
    });

    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("feedback.parse_failed", { error: msg });
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
