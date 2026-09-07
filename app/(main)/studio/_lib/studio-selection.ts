import type { AgentEntry } from "../_data/agents"
import type { Conversation } from "../_hooks/useStudioChat"

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
