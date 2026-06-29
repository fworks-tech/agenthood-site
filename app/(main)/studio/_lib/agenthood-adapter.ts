import { agentSkills } from "../_data/agents.generated";
import { AgentNotFoundError, ValidationError } from "./errors";
import { logger } from "./logger";
import type { LLMRequest, LLMConfig } from "agenthood/dist/llm/types";

type ProviderName = "anthropic" | "groq" | "openai" | "ollama" | "opencode" | "opencode-go";

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

const FALLBACK_ORDER: ProviderName[] = ["groq", "openai", "ollama"];

function isKnownProvider(name: string): name is ProviderName {
  return ["anthropic", "groq", "openai", "ollama", "opencode", "opencode-go"].includes(name);
}

export class LightweightAdapter implements AgenthoodAdapter {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ReadableStream> {
    const systemPrompt = agentSkills[req.agentId];
    if (!systemPrompt) {
      throw new ValidationError(`No system prompt available for agent "${req.agentId}". Run sync-skills to generate prompts.`);
    }

    const { LLMRouter } = await import("agenthood/dist/llm");
    const providerName = req.config?.provider || "anthropic";

    if (!isKnownProvider(providerName)) {
      throw new ValidationError(`Unknown provider: "${providerName}"`);
    }

    const providers = [
      { name: providerName as ProviderName, apiKey: req.config?.apiKey, baseUrl: req.config?.baseUrl },
      ...FALLBACK_ORDER.filter((p) => p !== providerName).map((name) => ({ name })),
    ];

    const llmConfig: LLMConfig = {
      providers,
      failureThreshold: 3,
      cooldownMs: 30000,
    };

    logger.info("chat.routing", { agentId: req.agentId, primary: providerName, fallbacks: FALLBACK_ORDER });
    const startTime = performance.now();

    const provider = await LLMRouter.fromConfig(llmConfig);

    if (req.config?.model) {
      try { provider.setModel(req.config.model); } catch { /* use provider default */ }
    }

    const llmRequest: LLMRequest = {
      messages: [
        { role: "system", content: systemPrompt },
        ...req.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      temperature: req.config?.temperature,
      maxTokens: req.config?.maxTokens,
    };

    const asyncGen = await provider.stream(llmRequest);

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
          logger.info("chat.complete", { agentId: req.agentId, primary: providerName, durationMs: duration, chunks: tokenCount });
        } catch (err) {
          if (signal?.aborted) {
            logger.info("chat.aborted", { agentId: req.agentId });
            controller.close();
            return;
          }
          const msg = err instanceof Error ? err.message : String(err);
          logger.error("chat.error", { agentId: req.agentId, error: msg });
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "error", data: msg }) + "\n"));
        } finally {
          controller.close();
        }
      },
    });
  }
}
