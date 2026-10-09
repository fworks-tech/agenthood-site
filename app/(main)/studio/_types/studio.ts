export type Provider = "anthropic" | "openai" | "groq" | "ollama" | "opencode" | "opencode-go" | "openrouter";

export interface ChatConfig {
  /** @deprecated Pinned server-side to DEMO_PROVIDER. Kept for localStorage migration. */
  provider: Provider;
  /** @deprecated Pinned server-side to the tier map. Kept for localStorage migration. */
  model: string;
  /** @deprecated Pinned server-side to 0.7. Kept for localStorage migration. */
  temperature: number;
  /** @deprecated Pinned server-side to DEMO_MAX_TOKENS. Kept for localStorage migration. */
  maxTokens: number;
  systemPrompt: string;
  /** @deprecated No longer set by clients; server never uses it. Kept for localStorage migration. */
  baseUrl?: string;
  /** @deprecated No longer set by clients; server never uses it. Kept for localStorage migration. */
  apiKey?: string;
  enabledTools?: string[];
}

export const DEMO_PROVIDER: Provider = "opencode";
// Output cap (abuse guard): input bounded by route (50 msgs / 4k chars / 100k total)
// and rate-limited to 20 req/min ⇒ output was the only open dimension.
// 20 req/min × 16,384 tokens = 327,680 tokens/min (worst case at default-tier pricing).
export const DEMO_MAX_TOKENS = 16384;

// Members whose lane writes, reviews or operates code. This is the identity
// signal for capability, not a model heuristic: it decides who gets the
// code_execution sandbox. The 11 prose-lane members (scribe, herald,
// librarian, oracle, mediator, ...) write no code artifacts and must not be
// handed a JS VM — see getMemberTools().
export const CODE_AGENTS = new Set([
  "the-architect",
  "the-builder",
  "the-reviewer",
  "the-tester",
  "the-debugger",
  "the-warden",
  "the-auditor",
  "the-doorman",
  "the-operator",
]);

// Capability follows identity. web_fetch is cross-cutting (any member may need
// to read a source); activate_skill is how a member loads its own operating
// manual, so every member gets it; the code_execution VM is code-lane only.
export function getMemberTools(memberId: string): string[] {
  return CODE_AGENTS.has(memberId)
    ? ["web_fetch", "activate_skill", "code_execution"]
    : ["web_fetch", "activate_skill"];
}

// Tiered demo models. Selection is a pure heuristic (no LLM call) enforced
// server-side. Every tier MUST be reachable through the endpoint the site picks
// for it — see `zen.ts` `zenProtocolForModel`. The pinned `agenthood` opencode
// provider speaks only /v1/chat/completions, so a /v1/messages model is served
// by the site's own ZenMessagesProvider (that is the point of `zen.ts`: the
// site, not the dependency, owns Zen endpoint compliance).
// Rejected on protocol grounds: gpt-5-nano (/v1/responses, no tools on Zen);
// jev-1.13 (/v1/systemone, a decision model that emits no prose — see the
// routing classifier). Chosen: qwen3.8-flash, served on /v1/messages.
// - Q&A (no tools) and Code (tools on) currently share the model; re-split when
//   a second tier is verified to serve the tools protocol over /v1/messages.
// Worst case stays bounded: 20 req/min × 16,384 tokens per response.
export const DEMO_QA_MODEL = "qwen3.8-flash";
export const DEMO_CODE_MODEL = "qwen3.8-flash";

// Roles a client may put in a playground message. `system` is excluded because
// a forged system message lands after the member's real system prompt and
// overrides it (prompt injection). `tool` is excluded because the playground
// rebuilds tool results server-side each turn, so the client never needs to
// send one — accepting it would only let a client forge a tool result.
// The chat route rejects these and the adapter enforces them again, so the
// rule holds no matter which caller reaches the provider.
export const CLIENT_MESSAGE_ROLES = ["user", "assistant"] as const;

export function selectDemoModel(
  agentId: string,
  messages: { content: string }[],
  toolsOn: boolean,
): string {
  const hasCode = messages.some((m) => m.content.includes("```"));
  // Deepseek-v4-flash is currently the only tier verified to serve both the
  // prose and the tools protocol, so the no-tools branch returns the same
  // value. Merge it into the tool-capable branch; re-split here when a second
  // model passes a live turn probe.
  if (CODE_AGENTS.has(agentId) || hasCode || toolsOn) return DEMO_CODE_MODEL;
  return DEMO_QA_MODEL;
}
