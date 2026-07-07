import { agentSkills } from "../_data/agents.generated";
import { ValidationError } from "./errors";
import { logger } from "./logger";
import type { LLMRequest, LLMConfig, Message, ToolSchema } from "agenthood/dist/llm/types";
import { getToolSchemas, executeTool, MAX_TOOL_ITERATIONS } from "./tools";
import type { ToolCall } from "./tools";

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
    enabledTools?: string[];
  };
}

export interface AgenthoodAdapter {
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ReadableStream>;
}

const FALLBACK_ORDER: ProviderName[] = ["groq", "openai", "ollama"];

function isKnownProvider(name: string): name is ProviderName {
  return ["anthropic", "groq", "openai", "ollama", "opencode", "opencode-go"].includes(name);
}

function buildLLMMessages(req: ChatRequest, systemPrompt: string): Message[] {
  return [
    { role: "system", content: systemPrompt },
    ...req.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];
}

function buildLLMConfig(providerName: ProviderName, req: ChatRequest): LLMConfig {
  return {
    providers: [
      { name: providerName, apiKey: req.config?.apiKey, baseUrl: req.config?.baseUrl },
      ...FALLBACK_ORDER.filter((p) => p !== providerName).map((name) => ({ name })),
    ],
    failureThreshold: 3,
    cooldownMs: 30000,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class LightweightAdapter implements AgenthoodAdapter {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ReadableStream> {
    const systemPrompt = agentSkills[req.agentId];
    if (!systemPrompt) {
      throw new ValidationError(`No system prompt available for agent "${req.agentId}". Run sync-skills to generate prompts.`);
    }

    const providerName = req.config?.provider || "anthropic";
    if (!isKnownProvider(providerName)) {
      throw new ValidationError(`Unknown provider: "${providerName}"`);
    }

    const llmConfig = buildLLMConfig(providerName, req);
    const enabledTools = req.config?.enabledTools ?? [];

    const startTime = performance.now();
    logger.info("chat.routing", { agentId: req.agentId, primary: providerName, fallbacks: FALLBACK_ORDER, tools: enabledTools });

    const messages = buildLLMMessages(req, systemPrompt);

    const allSchemas = getToolSchemas();
    const toolSchemas = enabledTools.length > 0
      ? allSchemas.filter((s) => enabledTools.includes(s.name))
      : undefined;

    return new ReadableStream({
      async start(controller) {
        let tokenCount = 0;
        try {
          const { LLMRouter } = await import("agenthood/dist/llm");
          const provider = await LLMRouter.fromConfig(llmConfig);
          if (req.config?.model) {
            try { provider.setModel(req.config.model); } catch { }
          }

          if (toolSchemas && toolSchemas.length > 0) {
            const toolCallsRun: ToolCall[] = [];
            const finalText = await runToolLoop(provider, messages, toolSchemas, toolCallsRun, signal);

            for (const tc of toolCallsRun) {
              controller.enqueue(new TextEncoder().encode(
                JSON.stringify({ type: "tool_call", id: tc.id, name: tc.name, args: tc.args }) + "\n",
              ));
              controller.enqueue(new TextEncoder().encode(
                JSON.stringify({
                  type: "tool_result", id: tc.id, name: tc.name,
                  result: tc.result ?? tc.error,
                  error: tc.error,
                }) + "\n",
              ));
            }

            for (const char of finalText) {
              if (signal?.aborted) break;
              tokenCount++;
              controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "token", data: char }) + "\n"));
            }
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "done" }) + "\n"));
          } else {
            const finalRequest: LLMRequest = {
              messages,
              temperature: req.config?.temperature,
              maxTokens: req.config?.maxTokens,
            };
            const asyncGen = await provider.stream(finalRequest);

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

          const isMissingKey = /(?:api[_-]?key|not set|auth)/i.test(msg) || msg.includes("MissingApiKeyError");
          const errorMessage = isMissingKey
            ? "No API key configured for the selected provider. Provide a key in the config panel, or ensure the server has the provider's API key set."
            : msg;

          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "error", data: errorMessage }) + "\n"));
        } finally {
          controller.close();
        }
      },
    });
  }
}

async function runToolLoop(
  provider: { complete: (req: LLMRequest) => Promise<{ content: string; toolCalls?: { id: string; name: string; args: unknown }[] }> },
  messages: Message[],
  toolSchemas: ToolSchema[],
  toolCallsRun: ToolCall[],
  signal?: AbortSignal,
): Promise<string> {
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    if (signal?.aborted) return "";

    const resp = await provider.complete({
      messages,
      tools: toolSchemas,
    });

    if (!resp.toolCalls || resp.toolCalls.length === 0) {
      return resp.content;
    }

    messages.push({
      role: "assistant",
      content: resp.content || "",
      toolCalls: resp.toolCalls.map((tc) => ({ id: tc.id, name: tc.name, args: tc.args })),
    });

    for (const tc of resp.toolCalls) {
      if (signal?.aborted) return "";
      const args = tc.args as Record<string, unknown>;
      const result = await executeTool(tc.name, args, signal);
      toolCallsRun.push({ id: tc.id, name: tc.name, args, result, error: undefined });
      messages.push({ role: "tool", content: result, tool_call_id: tc.id, name: tc.name });
    }
  }

  return "I've reached the maximum number of tool operations for this request. Please refine your question.";
}
