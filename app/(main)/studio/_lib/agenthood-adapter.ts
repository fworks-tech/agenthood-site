import { buildSystemPrompt } from "./system-prompt";
import { ValidationError } from "./errors";
import { logger } from "./logger";
import type { LLMRequest, LLMConfig, Message, ToolSchema } from "agenthood/dist/llm";
import { getToolSchemas, executeTool, MAX_TOOL_ITERATIONS, classifyToolResult } from "./tools";
import type { ToolCall } from "./tools";
import { emitLogEvent, buildTraceEnvelope } from "./trace";
import { generateId } from "./ids";
import {
  DEMO_MAX_TOKENS,
  DEMO_MODEL,
  DEMO_PROVIDER,
  DEMO_TEMPERATURE,
  type Provider,
} from "../_types/studio";

export interface ChatRequest {
  agentId: string;
  messages: { role: string; content: string }[];
  config?: {
    enabledTools?: string[];
  };
  correlationId?: string;
}

export interface AgenthoodAdapter {
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ReadableStream>;
}

// CLI priority chain — mirrors .agenthood/config.json (opencode p1)
export const CLI_PROVIDER_CHAIN: readonly Provider[] = ['opencode', 'opencode-go', 'anthropic', 'groq', 'ollama']

function buildLLMMessages(req: ChatRequest, systemPrompt: string): Message[] {
  return [
    { role: "system", content: systemPrompt },
    ...req.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];
}

function buildLLMConfig(): LLMConfig {
  return {
    providers: CLI_PROVIDER_CHAIN.map((name) => ({ name })),
    failureThreshold: 3,
    cooldownMs: 60000,
    probeEnabled: true,
  };
}


export class LightweightAdapter implements AgenthoodAdapter {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ReadableStream> {
    const systemPrompt = buildSystemPrompt(req.agentId);
    if (!systemPrompt) {
      throw new ValidationError(`No system prompt available for agent "${req.agentId}". Run sync-skills to generate prompts.`);
    }

    const providerName = DEMO_PROVIDER;

    const llmConfig = buildLLMConfig();
    const enabledTools = req.config?.enabledTools ?? [];

    const startTime = performance.now();
    const correlationId = req.correlationId ?? `pg-${generateId()}`;
    const inputChars = req.messages.reduce((n, m) => n + m.content.length, 0) + systemPrompt.length;
    logger.info("chat.routing", { agentId: req.agentId, primary: providerName, fallbacks: CLI_PROVIDER_CHAIN, tools: enabledTools, correlationId });

    const messages = buildLLMMessages(req, systemPrompt);

    const allSchemas = getToolSchemas();
    const toolSchemas = enabledTools.length > 0
      ? allSchemas.filter((s) => enabledTools.includes(s.name))
      : undefined;

    function emitTrace(controller: ReadableStreamDefaultController<Uint8Array>, status: "success" | "error", output: string): void {
      const envelope = buildTraceEnvelope({
        member: req.agentId,
        input: req.messages.map((m) => m.content).join("\n"),
        output,
        durationMs: Math.round(performance.now() - startTime),
        model: DEMO_MODEL,
        correlationId,
        source: "playground",
        status,
        inputChars,
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
          fallbacks: CLI_PROVIDER_CHAIN,
          tools: enabledTools,
          correlationId,
        });
        try {
          const { LLMRouter } = await import("agenthood/dist/llm");
          const provider = await LLMRouter.fromConfig(llmConfig);
          // Swallowing this would silently bill the router's default model
          // instead, so surface it — the demo's cost guarantee depends on it.
          try {
            provider.setModel(DEMO_MODEL);
          } catch (err) {
            logger.warn("chat.set_model_failed", { model: DEMO_MODEL, error: String(err), correlationId });
          }

          if (toolSchemas && toolSchemas.length > 0) {
            const toolCallsRun: ToolCall[] = [];
            const emit = (event: Record<string, unknown>) => {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
            };
            const finalText = await runToolLoop(provider, messages, toolSchemas, toolCallsRun, signal, emit);
            output = finalText;

            for (const char of finalText) {
              if (signal?.aborted) break;
              outputChars++;
              controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "token", data: char }) + "\n"));
            }
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "done" }) + "\n"));
          } else {
            const finalRequest: LLMRequest = {
              messages,
              temperature: DEMO_TEMPERATURE,
              // Abuse guard, not a quality knob: input is already bounded by the
              // route (50 msgs / 4k chars each / 100k total) and requests are
              // rate-limited to 20/min, so output is the only open dimension.
              maxTokens: DEMO_MAX_TOKENS,
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
            ? "The model provider has no API key configured on the server."
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
  signal: AbortSignal | undefined,
  emit: (event: Record<string, unknown>) => void,
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
      emit({ type: "tool_call", id: tc.id, name: tc.name, args });
      const result = await executeTool(tc.name, args, signal);
      const outcome = classifyToolResult(result);
      toolCallsRun.push({ id: tc.id, name: tc.name, args, result: outcome.result, error: outcome.error });
      messages.push({ role: "tool", content: result, tool_call_id: tc.id, name: tc.name });
      emit({
        type: "tool_result", id: tc.id, name: tc.name,
        result: outcome.result ?? outcome.error,
        error: outcome.error,
      });
    }
  }

  return "I've reached the maximum number of tool operations for this request. Please refine your question.";
}
