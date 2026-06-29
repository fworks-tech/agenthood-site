import { agentSkills } from "../_data/agents.generated";
import { getAgentById } from "../_data/agents";
import { resolveProvider } from "./provider";
import { getMaxTokens } from "./env";
import { AgentNotFoundError, ValidationError } from "./errors";
import { logger } from "./logger";
import type { StreamingProvider } from "./provider";

export interface ChatRequest {
  agentId: string;
  messages: { role: string; content: string }[];
}

export interface AgenthoodAdapter {
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ReadableStream>;
}

export class LightweightAdapter implements AgenthoodAdapter {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ReadableStream> {
    const agent = getAgentById(req.agentId);
    if (!agent) throw new AgentNotFoundError(req.agentId);

    const systemPrompt = agentSkills[req.agentId];
    if (!systemPrompt) {
      throw new ValidationError(`No system prompt available for agent "${req.agentId}". Run sync-skills to generate prompts.`);
    }

    const { name, instance } = resolveProvider(agent.preferredProvider);

    logger.info("chat.request", { agentId: req.agentId, provider: name, messageCount: req.messages.length });

    const startTime = performance.now();

    const stream = await instance.stream(systemPrompt, req.messages, signal);

    const wrapped = new ReadableStream({
      async start(controller) {
        const reader = stream.getReader();
        let tokenCount = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            tokenCount++;
            controller.enqueue(value);
          }
          const duration = Math.round(performance.now() - startTime);
          logger.info("chat.complete", { agentId: req.agentId, provider: name, durationMs: duration, chunks: tokenCount });
        } catch (err) {
          if (signal?.aborted) {
            logger.info("chat.aborted", { agentId: req.agentId, provider: name });
            controller.close();
            return;
          }
          const msg = err instanceof Error ? err.message : String(err);
          logger.error("chat.error", { agentId: req.agentId, provider: name, error: msg });
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "error", data: "An error occurred while processing your request." }) + "\n"));
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
    });

    return wrapped;
  }
}
