import { agentSkills } from "../_data/agents.generated";
import { AgentNotFoundError, ValidationError } from "./errors";
import { logger } from "./logger";
import type { LLMConfig, LLMRequest } from "agenthood/dist/llm/types";

export interface ChatRequest {
  agentId: string;
  messages: { role: string; content: string }[];
  config?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
  };
}

export interface AgenthoodAdapter {
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ReadableStream>;
}

export class LightweightAdapter implements AgenthoodAdapter {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ReadableStream> {
    const systemPrompt = agentSkills[req.agentId];
    if (!systemPrompt) {
      throw new ValidationError(`No system prompt available for agent "${req.agentId}". Run sync-skills to generate prompts.`);
    }

    const { LLMRouter } = await import("agenthood/dist/llm");
    const providerName = req.config?.provider || "anthropic";

    const llmConfig: LLMConfig = {
      provider: providerName,
      baseUrl: req.config?.baseUrl,
      apiKey: req.config?.apiKey,
    };

    const provider = await LLMRouter.createForMember(providerName as never, llmConfig);
    const startTime = performance.now();

    if (req.config?.model) {
      try { provider.setModel(req.config.model); } catch { /* use provider default */ }
    }

    const request: LLMRequest = {
      messages: [
        { role: "system", content: systemPrompt },
        ...req.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      temperature: req.config?.temperature,
      maxTokens: req.config?.maxTokens,
    };

    const asyncGen = await provider.stream(request);

    return new ReadableStream({
      async start(controller) {
        let tokenCount = 0;
        try {
          for await (const chunk of asyncGen) {
            if (signal?.aborted) break;
            if (chunk.delta) {
              tokenCount++;
              controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "token", data: chunk.delta }) + "\n"));
            }
            if (chunk.done) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "done" }) + "\n"));
              break;
            }
          }
          const duration = Math.round(performance.now() - startTime);
          logger.info("chat.complete", { agentId: req.agentId, provider: providerName, durationMs: duration, chunks: tokenCount });
        } catch (err) {
          if (signal?.aborted) {
            logger.info("chat.aborted", { agentId: req.agentId, provider: providerName });
            controller.close();
            return;
          }
          const msg = err instanceof Error ? err.message : String(err);
          logger.error("chat.error", { agentId: req.agentId, provider: providerName, error: msg });
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "error", data: "An error occurred while processing your request." }) + "\n"));
        } finally {
          controller.close();
        }
      },
    });
  }
}
