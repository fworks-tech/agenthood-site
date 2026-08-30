# Spec: useStudioChat Hook Extraction

## Problem

`useStudioChat.ts` (600 lines) combines:
- Conversation persistence (localStorage CRUD, hydration)
- SSE streaming (sendMessage, retrySendMessage, abortStream)
- Token counting (totalTokens, estimateTokens, persistTokens)
- Tool call tracking (pendingToolCalls, onToolCall, onToolResult, replayToolCall)

Critical issues:
- `sendMessage` and `retrySendMessage` are ~300 lines each, 95% identical
- `persistTokens` reads `conversationsRef.current` while functional updates use stale closures → lost updates
- Single hook exceeds 300-line guidance

## Proposed Solution

Extract into 4 focused hooks + facade.

### 1. `useConversations` — Persistence Layer

**File:** `app/(main)/studio/_hooks/useConversations.ts`

**Exports:**
```ts
interface UseConversationsReturn {
  conversations: Conversation[];
  activeConversationId: string | null;
  hydrated: boolean;
  newConversation: (agentId: string, config?: Partial<ChatConfig>) => void;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  clearMessages: () => void;
  persist: (convs: Conversation[], activeId: string | null) => void; // internal
}
```

**Responsibilities:**
- `loadConversations` / `saveConversations` / `getActiveId` / `setActiveId` (pure functions)
- `useHydrateOnClient` hydration effect
- `conversationsRef` sync effect
- `persist` callback: `setConversations` + `conversationsRef.current` + `saveConversations` + `setActiveConversationId` + `setActiveId`
- `newConversation`, `switchConversation`, `deleteConversation`, `clearMessages` — all call `persist`
- **No streaming, no tokens, no tools**

### 2. `useChatStreaming` — Streaming Layer

**File:** `app/(main)/studio/_hooks/useChatStreaming.ts`

**Exports:**
```ts
interface UseChatStreamingReturn {
  isStreaming: boolean;
  messages: ChatMessage[];
  sendMessage: (content: string, turnstileToken?: string) => Promise<void>;
  retrySendMessage: (content: string, turnstileToken?: string) => Promise<void>;
  abortStream: () => void;
  // Internal callbacks for tool calls
  onToolCall: (tc: ToolCallInfo) => void;
  onToolResult: (tr: ToolResult) => void;
}
```

**Responsibilities:**
- `sendMessageCore` — shared logic for both send and retry
- `sendMessage` — adds user message, calls `sendMessageCore`
- `retrySendMessage` — finds last user message, adds assistant placeholder, calls `sendMessageCore`
- `abortStream` — aborts current controller
- `readSSEStream` integration with callbacks:
  - `onToken` → updates message content, calls `onTokenProgress` (token estimation)
  - `onToolCall` → calls `onToolCall` callback
  - `onToolResult` → calls `onToolResult` callback
  - `onDone` → calls `onComplete` with final content
  - `onError` → calls `onError`
- **No persistence, no token counting, no tool state** — delegates via callbacks

**Shared `sendMessageCore` signature:**
```ts
async function sendMessageCore({
  agentId,
  messages,           // messages to send (without the new assistant placeholder)
  config,
  turnstileToken,
  requestId,
  abortSignal,
  onTokenProgress,    // (estimatedTokens: number) => void
  onToolCall,         // (tc: ToolCallInfo) => void
  onToolResult,       // (tr: ToolResult) => void
  onComplete,         // (finalContent: string, finalToolCalls: ToolCallInfo[]) => void
  onError,            // (err: Error) => void
  onLog,              // (log: StreamLogEvent) => void
}): Promise<void>
```

### 3. `useTokenCount` — Token Counting Layer

**File:** `app/(main)/studio/_hooks/useTokenCount.ts`

**Exports:**
```ts
interface UseTokenCountReturn {
  totalTokens: number;
  estimateTokens: (text: string) => number;
  resetTokens: () => void;
  // Callback for streaming hook
  onTokenProgress: (estimatedTokens: number) => void;
}
```

**Responsibilities:**
- `totalTokens` state
- `estimateTokens(text) = Math.ceil(text.length / 4)`
- `onTokenProgress` — updates `totalTokens` from base + estimated
- `resetTokens` — sets to 0
- **No persistence** — persistence handled by `useConversations` via callback

### 4. `useToolCalls` — Tool Tracking Layer

**File:** `app/(main)/studio/_hooks/useToolCalls.ts`

**Exports:**
```ts
interface UseToolCallsReturn {
  pendingToolCalls: ToolCallInfo[];
  onToolCall: (tc: ToolCallInfo) => void;
  onToolResult: (tr: ToolResult) => void;
  withToolResults: (convs: Conversation[], convId: string, msgId: string, calls: ToolCallInfo[]) => Conversation[];
  replayToolCall: (messageId: string, toolCallId: string, turnstileToken?: string) => Promise<{ ok: boolean; outcome: { error?: string } }>;
}
```

**Responsibilities:**
- `pendingToolCalls` state
- `onToolCall` — adds to pending
- `onToolResult` — updates pending, calls `withToolResults` for persistence
- `withToolResults` — pure function, updates conversation messages
- `replayToolCall` — calls `replayToolExecution`, applies `applyToolReplayOutcome`, persists
- **No streaming, no persistence** — `withToolResults` returns updated conversations for caller to persist

### 5. `useStudioChat` — Facade (Backward Compatible)

**File:** `app/(main)/studio/_hooks/useStudioChat.ts` (rewritten)

**Composes:**
```ts
const conversations = useConversations({ config: configRef.current, onLog });
const streaming = useChatStreaming({
  activeConversationId: conversations.activeConversationId,
  conversations: conversations.conversations,
  config: configRef.current,
  onLog,
  onTokenProgress: tokenCount.onTokenProgress,
  onToolCall: toolCalls.onToolCall,
  onToolResult: toolCalls.onToolResult,
  onComplete: (content, toolCalls) => {
    // Persist final state via conversations.persist
    const updated = conversations.conversations.map(...);
    conversations.persist(updated, conversations.activeConversationId);
    tokenCount.resetTokens(); // or set final
  },
  onError: (err) => {
    // Persist error state
    const updated = ...;
    conversations.persist(updated, conversations.activeConversationId);
  },
});
const tokenCount = useTokenCount({ baseTokens: activeConv?.tokenCount ?? 0 });
const toolCalls = useToolCalls({
  activeConversationId: conversations.activeConversationId,
  conversations: conversations.conversations,
  persist: conversations.persist,
});
```

**Returns:** Original `UseStudioChatReturn` interface unchanged.

## Acceptance Criteria

- [ ] Each hook <200 lines
- [ ] `sendMessage`/`retrySendMessage` share 100% of streaming logic via `sendMessageCore`
- [ ] No `persistTokens` function exists
- [ ] `conversationsRef.current` never read in hot paths (only in `persist` callback)
- [ ] All existing unit tests pass (252 tests)
- [ ] All e2e tests pass
- [ ] Facade `useStudioChat` exports identical interface

## Testing

- Unit tests for each hook in `__tests__/hooks/`:
  - `useConversations.test.ts` — CRUD, hydration, persistence
  - `useChatStreaming.test.ts` — send/retry/abort, tool callbacks
  - `useTokenCount.test.ts` — estimation, progress, reset
  - `useToolCalls.test.ts` — pending, results, replay
- Integration test: `useStudioChat.test.ts` — facade composition

## Migration Notes

- `page.tsx` imports remain unchanged (`import { useStudioChat } from "../_hooks/useStudioChat"`)
- `Conversation` type stays in `useStudioChat.ts` (or moved to `_types/studio.ts` if shared)
- `STORAGE_KEYS`, `MAX_CONVERSATIONS`, `MAX_CONVERSATION_AGE_MS` stay in `useConversations.ts`