import type { Conversation } from "../_hooks/useStudioChat";
import type { ExecuteToolResponse } from "./studio-api";

/**
 * Applies a tool re-execution outcome back onto a conversation: the matching
 * tool call inside `messageId` flips to complete/error with the fresh result or
 * error and a computed duration. Pure so it can be unit-tested without a UI.
 */
export function applyToolReplayOutcome(
  conversation: Conversation,
  messageId: string,
  toolCallId: string,
  outcome: ExecuteToolResponse,
  now: number = Date.now(),
): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) => {
      if (message.id !== messageId) return message;
      return {
        ...message,
        toolCalls: (message.toolCalls ?? []).map((toolCall) => {
          if (toolCall.id !== toolCallId) return toolCall;
          return {
            ...toolCall,
            status: outcome.error ? "error" : "complete",
            result: outcome.error ? undefined : outcome.result,
            error: outcome.error ?? undefined,
            completedAt: now,
            durationMs: toolCall.startedAt ? now - toolCall.startedAt : undefined,
          };
        }),
      };
    }),
  };
}