import type { AgentEntry } from "../_data/agents"
import type { Conversation } from "../_hooks/useStudioChat"
import type { ChatConfig } from "../_types/studio"

// The viewed agent must always be the agent that owns the active conversation,
// so switching to (or reloading into) a conversation renders its messages and
// correct member header instead of falling back to the welcome screen.
export function resolveActiveAgent(
  conversations: Conversation[],
  activeConversationId: string | null,
  agents: AgentEntry[],
): AgentEntry | null {
  if (!activeConversationId) return null
  const conv = conversations.find((c) => c.id === activeConversationId)
  if (!conv) return null
  return agents.find((a) => a.id === conv.agentId) ?? null
}

// Provider/model are uniform across agents, so the only per-conversation config
// that must follow a switch is the agent's system prompt. Restore just that —
// never the whole stored config — so it does not clobber the user's live model
// or temperature edits. Returns the same reference when nothing changes so the
// caller can skip a needless state update.
export function activeConfigForConversation(
  prev: ChatConfig,
  conv: Conversation | undefined,
): ChatConfig {
  const prompt = conv?.config?.systemPrompt
  if (!prompt || prev.systemPrompt === prompt) return prev
  return { ...prev, systemPrompt: prompt }
}
