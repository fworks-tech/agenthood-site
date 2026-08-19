import { agentSkills } from "../_data/agents.generated";
import { ValidationError } from "./errors";
import { logger, pickSafeLogMeta } from "./logger";
import type { LLMRequest, LLMConfig, Message, ToolSchema } from "agenthood/dist/llm/types";
import { createTraceEnvelope, estimateCostFromTokens } from "agenthood/dist/core";
import { getToolSchemas, executeTool, MAX_TOOL_ITERATIONS } from "./tools";
import type { ToolCall } from "./tools";

type ProviderName = "anthropic" | "groq" | "openai" | "ollama" | "opencode" | "opencode-go" | "openrouter";

const TRACE_PAYLOAD_MAX = 8000;

type LogLevel = "info" | "warn" | "error";

function emitLogEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  level: LogLevel,
  event: string,
  meta: Record<string, unknown> = {},
): void {
  // Duplicates the server-side structured log into the SSE stream so the client
  // LiveLogs can correlate. Only pickSafeLogMeta's allowlist is forwarded.
  controller.enqueue(
    new TextEncoder().encode(JSON.stringify({ type: "log", level, event, ...pickSafeLogMeta(meta) }) + "\n"),
  );
}

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
  correlationId?: string;
}

export interface AgenthoodAdapter {
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ReadableStream>;
}

const FALLBACK_ORDER: ProviderName[] = ["groq", "openai", "ollama"];

function isKnownProvider(name: string): name is ProviderName {
  return ["anthropic", "groq", "openai", "ollama", "opencode", "opencode-go", "openrouter"].includes(name);
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


export class LightweightAdapter implements AgenthoodAdapter {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ReadableStream> {
    const systemPrompt = agentSkills[req.agentId];
    if (!systemPrompt) {
      throw new ValidationError(`No system prompt available for agent "${req.agentId}". Run sync-skills to generate prompts.`);
    }

    const providerName = req.config?.provider || "opencode";
    if (!isKnownProvider(providerName)) {
      throw new ValidationError(`Unknown provider: "${providerName}"`);
    }

    const llmConfig = buildLLMConfig(providerName, req);
    const enabledTools = req.config?.enabledTools ?? [];

    const startTime = performance.now();
    const correlationId = req.correlationId ?? crypto.randomUUID?.() ?? `pg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const inputChars = req.messages.reduce((n, m) => n + m.content.length, 0) + systemPrompt.length;
    logger.info("chat.routing", { agentId: req.agentId, primary: providerName, fallbacks: FALLBACK_ORDER, tools: enabledTools, correlationId });

    const messages = buildLLMMessages(req, systemPrompt);

    const allSchemas = getToolSchemas();
    const toolSchemas = enabledTools.length > 0
      ? allSchemas.filter((s) => enabledTools.includes(s.name))
      : undefined;

    function emitTrace(controller: ReadableStreamDefaultController<Uint8Array>, status: "success" | "error", output: string): void {
      const inputTokens = Math.ceil(inputChars / 4);
      const outputTokens = Math.ceil(output.length / 4);
      const model = req.config?.model ?? "unknown";
      const envelope = createTraceEnvelope({
        member: req.agentId,
        input: req.messages.map((m) => m.content).join("\n").slice(0, TRACE_PAYLOAD_MAX),
        output: output.slice(0, TRACE_PAYLOAD_MAX),
        durationMs: Math.round(performance.now() - startTime),
        tokenCount: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
        cost: estimateCostFromTokens(model, inputTokens, outputTokens),
        qualityScore: null,
        status,
        correlationId,
        source: "playground",
        model,
      });
      logger.info("trace", { ...envelope });
      emitLogEvent(controller, "info", "trace", envelope as unknown as Record<string, unknown>);
    }

    return new ReadableStream({
      async start(controller) {
        let outputChars = 0;
        let output = "";
        emitLogEvent(controller, "info", "chat.routing", {
          agentId: req.agentId,
          primary: providerName,
          fallbacks: FALLBACK_ORDER,
          tools: enabledTools,
          correlationId,
        });
        try {
          const { LLMRouter } = await import("agenthood/dist/llm");
          const provider = await LLMRouter.fromConfig(llmConfig);
          if (req.config?.model) {
            try { provider.setModel(req.config.model); } catch { }
          }

          if (toolSchemas && toolSchemas.length > 0) {
            const toolCallsRun: ToolCall[] = [];
            const finalText = await runToolLoop(provider, messages, toolSchemas, toolCallsRun, signal);
            output = finalText;

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
              outputChars++;
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
                outputChars += chunk.delta.length;
                output += chunk.delta;
                controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "token", data: chunk.delta }) + "\n"));
              }
              if (chunk.done) {
                controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "done" }) + "\n"));
                break;
              }
            }
          }

          const duration = Math.round(performance.now() - startTime);
          if (signal?.aborted) {
            logger.info("chat.aborted", { agentId: req.agentId, correlationId });
            emitLogEvent(controller, "warn", "chat.aborted", { agentId: req.agentId, correlationId });
            emitTrace(controller, "error", output);
            return;
          }
          logger.info("chat.complete", { agentId: req.agentId, primary: providerName, durationMs: duration, outputChars, correlationId });
          emitLogEvent(controller, "info", "chat.complete", { agentId: req.agentId, primary: providerName, durationMs: duration, outputChars, correlationId });
          emitTrace(controller, "success", output);
        } catch (err) {
          if (signal?.aborted) {
            logger.info("chat.aborted", { agentId: req.agentId, correlationId });
            emitLogEvent(controller, "warn", "chat.aborted", { agentId: req.agentId, correlationId });
            emitTrace(controller, "error", output);
            controller.close();
            return;
          }
          const msg = err instanceof Error ? err.message : String(err);
          logger.error("chat.error", { agentId: req.agentId, error: msg, correlationId });
          emitLogEvent(controller, "error", "chat.error", { agentId: req.agentId, provider: providerName, correlationId });
          emitTrace(controller, "error", output);

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
