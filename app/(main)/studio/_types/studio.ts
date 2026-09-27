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

// Tiered demo models: a 2-tier map. Selection is a pure heuristic (no LLM
// call) enforced server-side. All tiers must be chat-completions models on the
// pinned provider that can actually serve the request shape they are given.
// jev-1.13 was rejected because it is a System One decision model on
// /v1/systemone, not prose chat. gpt-5-nano was rejected as the balanced
// default because it does not support the tools protocol on Zen — it answered
// 400 "Model does not support this protocol" for every tool-enabled turn
// (every workspace member outside CODE_AGENTS, e.g. the-builder), while the
// code tier served the same requests fine.
// - Q&A (no tools): cheapest non-free chat model in the console.
// - Code (tools on, or a code agent / ``` fences): the tool-capable model.
// Prices live in the Zen console and rot fast, so they are not quoted here.
// Worst case stays bounded: 20 req/min × 16,384 tokens per response.
export const DEMO_QA_MODEL = "deepseek-v4-flash";
export const DEMO_CODE_MODEL = "deepseek-v4-flash";

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
