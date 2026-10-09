import { buildSystemPrompt } from "./system-prompt";
import { ValidationError } from "./errors";
import { logger } from "./logger";
import type { LLMRequest, LLMConfig, Message, ILLMProvider } from "agenthood/dist/llm";
import { getToolSchemas, PLAYGROUND_MAX_TOOL_ITERATIONS } from "./tools";
import { runToolLoop, withProviderRetry } from "./tool-loop";
import { zenProtocolForModel, ZenMessagesProvider } from "./zen";
import { emitLogEvent, buildTraceEnvelope } from "./trace";
import { generateId } from "./ids";
import {
  DEMO_MAX_TOKENS,
  DEMO_PROVIDER,
  CLIENT_MESSAGE_ROLES,
  getMemberTools,
  selectDemoModel,
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
export const CLI_PROVIDER_CHAIN: readonly Provider[] = ['opencode']

// The tool loop hands back the final text, so this path has no live delta to
// forward. Slicing it keeps the per-chunk enqueue cost of the plain path
// instead of paying one enqueue and one render per character.
//
// A slice boundary can bisect a surrogate pair. That is safe only because the
// client appends chunks into one string buffer; rendering each chunk as its
// own node would show U+FFFD for any emoji straddling a boundary.
const TOKEN_CHUNK = 128

// The route rejects other roles, but this is the last code that touches the
// array before the provider — a caller reaching the adapter directly must not
// be able to slip a forged system prompt in behind the member's own.
function buildLLMMessages(req: ChatRequest, systemPrompt: string): Message[] {
  for (const m of req.messages) {
    if (!(CLIENT_MESSAGE_ROLES as readonly string[]).includes(m.role)) {
      throw new ValidationError(
        `Message role "${m.role}" is not allowed (${CLIENT_MESSAGE_ROLES.join(", ")})`,
      );
    }
  }
  return [
    { role: "system", content: systemPrompt },
    ...req.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];
}

export function buildDemoLLMConfig(): LLMConfig {
  return {
    providers: CLI_PROVIDER_CHAIN.map((name) => ({ name })),
    failureThreshold: 3,
    cooldownMs: 60000,
    probeEnabled: true,
  };
}

// One Zen-compliant seam for both Studio surfaces. The pinned `agenthood`
// provider only speaks `/v1/chat/completions`, so a `/v1/messages` model
// (Claude, qwen3.8-flash) is served by ZenMessagesProvider and a Jev model is
// rejected outright rather than silently 400-ing. Shared so the playground and
// the workspace can never drift onto different endpoints again.
//
// Protocol -> Provider mapping:
//   'chat'      -> opencodeChatProvider (OpenAI SDK, /v1/chat/completions)
//   'messages'  -> ZenMessagesProvider      (Anthropic SDK, /v1/messages)
//   'responses' -> throw (GPT/Grok/Muse on /v1/responses - not implemented)
//   'systemone' -> throw (Jev on /v1/systemone - use jevChoice)
export async function resolveDemoProvider(model: string, llmConfig: LLMConfig, correlationId?: string): Promise<ILLMProvider> {
  const protocol = zenProtocolForModel(model)
  if (protocol === 'systemone') {
    throw new ValidationError(`Jev ("${model}") is a System One decision model — it emits no prose. Use it for routing confidence, not a chat turn.`)
  }
  if (protocol === 'messages') {
    const apiKey = process.env.OPENCODE_API_KEY
    if (!apiKey) {
      throw new ValidationError(`OPENCODE_API_KEY is not set — required for the Zen /v1/messages model "${model}".`)
    }
    return new ZenMessagesProvider(apiKey, model)
  }
  if (protocol === 'responses') {
    throw new ValidationError(`Zen model "${model}" uses /v1/responses, which the OpenCode chat provider does not speak. Choose a /v1/chat/completions or /v1/messages model.`)
  }
  const { LLMRouter } = await import("agenthood/dist/llm");
  const provider = await LLMRouter.fromConfig(llmConfig)
  // Never swallow: silently keeping the router default (a dead id, e.g. the old
  // mimo-v2.5) is what turns a bad config into a "typing forever" hang.
  try {
    provider.setModel(model)
  } catch (err) {
    logger.warn("chat.set_model_failed", { model, error: String(err), correlationId })
  }
  return provider
}

export class LightweightAdapter implements AgenthoodAdapter {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ReadableStream> {
    const systemPrompt = buildSystemPrompt(req.agentId);
    if (!systemPrompt) {
      throw new ValidationError(`No system prompt available for agent "${req.agentId}". Run sync-skills to generate prompts.`);
    }

    const providerName = DEMO_PROVIDER;

    const llmConfig = buildDemoLLMConfig();
    // Last gate before the provider: intersect with the member's identity
    // grant. The chat route already does this, but the adapter is the choke
    // point every caller shares, so the rule is enforced once, here.
    const granted = new Set(getMemberTools(req.agentId));
    const enabledTools = (req.config?.enabledTools ?? []).filter((t) => granted.has(t));
    const model = selectDemoModel(req.agentId, req.messages, enabledTools.length > 0);

    const startTime = performance.now();
    const correlationId = req.correlationId ?? `pg-${generateId()}`;
    const inputChars = req.messages.reduce((n, m) => n + m.content.length, 0) + systemPrompt.length;
    logger.info("chat.routing", { agentId: req.agentId, primary: providerName, model, fallbacks: CLI_PROVIDER_CHAIN, tools: enabledTools, correlationId });

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
        model,
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
          model,
          fallbacks: CLI_PROVIDER_CHAIN,
          tools: enabledTools,
          correlationId,
        });
        try {
          const provider = await resolveDemoProvider(model, llmConfig, correlationId);

          if (toolSchemas && toolSchemas.length > 0) {
            const emit = (event: Record<string, unknown>) => {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
            };
            const loop = await runToolLoop({
              provider,
              messages,
              toolSchemas,
              maxIterations: PLAYGROUND_MAX_TOOL_ITERATIONS,
              signal,
              onToolCall: (tc) => emit({ type: "tool_call", id: tc.id, name: tc.name, args: tc.args }),
              onToolResult: (tc, outcome) =>
                emit({
                  type: "tool_result",
                  id: tc.id,
                  name: tc.name,
                  result: outcome.result ?? outcome.error,
                  error: outcome.error,
                }),
            });
            output = loop.exhausted
              ? loop.text || "I've reached the maximum number of tool operations for this request. Please refine your question."
              : loop.text;

            for (let i = 0; i < output.length; i += TOKEN_CHUNK) {
              if (signal?.aborted) break;
              const chunk = output.slice(i, i + TOKEN_CHUNK);
              outputChars += chunk.length;
              controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "token", data: chunk }) + "\n"));
            }
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "done" }) + "\n"));
          } else {
            const finalRequest: LLMRequest = {
              messages,
              temperature: 0.7,  // DEMO_TEMPERATURE inlined
              // Abuse guard, not a quality knob: input is already bounded by the
              // route (50 msgs / 4k chars each / 100k total) and requests are
              // rate-limited to 20/min, so output is the only open dimension.
              maxTokens: DEMO_MAX_TOKENS,
            };
            const asyncGen = await withProviderRetry(() => provider.stream(finalRequest));

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
