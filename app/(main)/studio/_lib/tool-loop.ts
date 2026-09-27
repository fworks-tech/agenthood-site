import type { LLMRequest, Message, ToolSchema } from "agenthood/dist/llm";
import { executeTool, classifyToolResult, type ToolCall } from "./tools";
import { DEMO_MAX_TOKENS } from "../_types/studio";

/** The Studio is a fixed-temperature demo; the adapter has never exposed it. */
const DEMO_TEMPERATURE = 0.7;

export interface ToolLoopProvider {
  complete(
    req: LLMRequest,
  ): Promise<{ content: string; toolCalls?: { id: string; name: string; args: unknown }[] }>;
}

// Single retry on 5xx from the LLM provider (mirrors the web_fetch 5xx retry
// in tools.ts): Zen hosts intermittently 503, and one transient failure should
// not kill a whole turn. 4xx is the caller's mistake — no retry.
export async function withProviderRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/5\d\d/.test(msg)) throw err;
    await new Promise((r) => setTimeout(r, 500));
    return fn();
  }
}

export interface ToolLoopResult {
  /** Assistant text from the last iteration. Empty when none was produced. */
  text: string;
  /** The iteration cap was hit with tool calls still pending. */
  exhausted: boolean;
  /** Every tool call executed, in order. */
  calls: ToolCall[];
  /** The caller aborted mid-loop. */
  aborted: boolean;
}

export interface ToolLoopOptions {
  provider: ToolLoopProvider;
  /** Mutated in place with assistant and tool turns, as the provider expects. */
  messages: Message[];
  toolSchemas: ToolSchema[];
  maxIterations: number;
  signal?: AbortSignal;
  /** Fires before the tool runs, so the UI can show it pending or checkpoint. */
  onToolCall?: (call: { id: string; name: string; args: unknown }) => void;
  onToolResult?: (call: { id: string; name: string }, outcome: { result?: string; error?: string }) => void;
}

/**
 * The single tool loop behind both Studio surfaces.
 *
 * This exists because it was duplicated, and the copies drifted in exactly the
 * ways that caused production incidents: the playground copy was missing the
 * output cap and the 5xx retry that the workspace copy had, and neither checked
 * message roles. Anything that guards a provider call — the cap, the retry, the
 * role allowlist — now has one implementation that both surfaces get by
 * construction.
 *
 * `messages` is mutated in place because the provider needs the growing
 * transcript on the next iteration and callers need it afterwards for their own
 * fallback paths.
 *
 * Per-tool ordering is preserved for both callers: `onToolCall` fires, the tool
 * runs, then `onToolResult` fires, for each tool in turn.
 */
export async function runToolLoop(opts: ToolLoopOptions): Promise<ToolLoopResult> {
  const { provider, messages, toolSchemas, maxIterations, signal } = opts;
  const calls: ToolCall[] = [];

  for (let i = 0; i < maxIterations; i++) {
    if (signal?.aborted) return { text: "", exhausted: false, calls, aborted: true };

    // Same cap and retry on both surfaces. Without the cap the abuse guard only
    // covered tool-free turns, so the turns a visitor triggers by ticking a box
    // ran uncapped.
    const resp = await withProviderRetry(() =>
      provider.complete({
        messages,
        tools: toolSchemas,
        temperature: DEMO_TEMPERATURE,
        maxTokens: DEMO_MAX_TOKENS,
      }),
    );

    if (!resp.toolCalls || resp.toolCalls.length === 0) {
      return { text: resp.content, exhausted: false, calls, aborted: false };
    }

    messages.push({
      role: "assistant",
      content: resp.content || "",
      toolCalls: resp.toolCalls.map((tc) => ({ id: tc.id, name: tc.name, args: tc.args })),
    });

    for (const tc of resp.toolCalls) {
      if (signal?.aborted) return { text: "", exhausted: false, calls, aborted: true };

      const args = tc.args as Record<string, unknown>;
      opts.onToolCall?.(tc);
      const result = await executeTool(tc.name, args, signal);
      const outcome = classifyToolResult(result);
      calls.push({ id: tc.id, name: tc.name, args, result: outcome.result, error: outcome.error });
      messages.push({ role: "tool", content: result, tool_call_id: tc.id, name: tc.name });
      opts.onToolResult?.(tc, outcome);
    }

    if (i === maxIterations - 1) {
      return { text: resp.content, exhausted: true, calls, aborted: false };
    }
  }

  return { text: "", exhausted: true, calls, aborted: false };
}
