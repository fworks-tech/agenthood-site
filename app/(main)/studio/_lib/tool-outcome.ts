import type { Conversation } from "../_hooks/useStudioChat";
import type { ExecuteToolResponse } from "./studio-api";

/**
 * Applies a tool re-execution outcome back onto a conversation: the matching
 * tool call inside `messageId` flips to complete/error with the fresh result or
 * error and a computed duration. Pure so it can be unit-tested without a UI.
 *
 * Duration is measured from `startedAt` (the replay invocation time), not from
 * the original call's `startedAt`, so a replayed row reports its own latency
 * rather than the original think-time plus idle gap.
 */
export function applyToolReplayOutcome(
  conversation: Conversation,
  messageId: string,
  toolCallId: string,
  outcome: ExecuteToolResponse,
  now: number = Date.now(),
  startedAt: number = now,
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
            startedAt,
            completedAt: now,
            durationMs: now - startedAt,
          };
        }),
      };
    }),
  };
}
