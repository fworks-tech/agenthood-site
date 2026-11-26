import { logger } from "@/app/(main)/studio/_lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messageId, conversationId, value } = body;

    if (!messageId || typeof messageId !== "string" || messageId.length > 256) {
      logger.warn("feedback.validation_failed", { error: "missing messageId" });
      return Response.json({ error: "messageId is required" }, { status: 400 });
    }

    if (value !== "up" && value !== "down" && value !== null) {
      logger.warn("feedback.validation_failed", { error: "invalid value", value });
      return Response.json({ error: "value must be 'up', 'down', or null" }, { status: 400 });
    }

    const bounded = (v: unknown): string | undefined =>
      typeof v === "string" && v.length > 0 && v.length <= 256 ? v : undefined;

    logger.info("feedback.received", {
      messageId: messageId.slice(0, 256),
      conversationId: bounded(conversationId),
      value,
      ...(bounded(body.agentId) ? { agentId: bounded(body.agentId) } : {}),
      ...(bounded(body.provider) ? { provider: bounded(body.provider) } : {}),
      ...(bounded(body.model) ? { model: bounded(body.model) } : {}),
    });

    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("feedback.parse_failed", { error: msg });
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
