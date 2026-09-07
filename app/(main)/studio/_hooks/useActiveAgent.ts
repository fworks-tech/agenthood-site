"use client";

import { useMemo } from "react";
import type { AgentEntry } from "../_data/agents";
import type { Conversation } from "./useStudioChat";
import { resolveActiveAgent } from "../_lib/studio-selection";

export function useActiveAgent(
  conversations: Conversation[],
  activeConversationId: string | null,
  agents: AgentEntry[],
): AgentEntry | null {
  return useMemo(
    () => resolveActiveAgent(conversations, activeConversationId, agents),
    [conversations, activeConversationId, agents],
  );
}
