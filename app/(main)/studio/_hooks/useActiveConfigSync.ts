"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { ChatConfig } from "../_types/studio";
import type { Conversation } from "./useStudioChat";
import { activeConfigForConversation } from "../_lib/studio-selection";

// Keeps the composer's system prompt aligned with whichever conversation is
// active, so switching to another member's chat sends that member's prompt.
// Runs only on a change of active conversation (not on every conversation
// mutation) to avoid clobbering in-flight config edits during streaming.
export function useActiveConfigSync(
  conversations: Conversation[],
  activeConversationId: string | null,
  setConfig: Dispatch<SetStateAction<ChatConfig>>,
): void {
  const lastConvIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeConversationId || activeConversationId === lastConvIdRef.current) return;
    lastConvIdRef.current = activeConversationId;
    const conv = conversations.find((c) => c.id === activeConversationId);
    setConfig((prev) => activeConfigForConversation(prev, conv));
  }, [activeConversationId, conversations, setConfig]);
}
