# Spec: Playground Monolith Decomposition

## Problem

The `PlaygroundPage` component (971 lines) and `useStudioChat` hook (600 lines) are monolithic, violating single responsibility, causing:
- Send/retry code duplication (~300 lines each, 95% identical)
- Concurrency race in token persistence
- Layer boundary violations (UI imports `_lib/`)
- Untestable CAPTCHA, export, replay logic embedded in page
- Mobile/desktop UI logic interleaved

## Proposed Solution

Phased decomposition into focused hooks and components, maintaining backward compatibility via a facade `useStudioChat`.

### Phase 1: Hook Extraction (Stacked Branch)

| Hook | Responsibility | Source Lines |
|------|----------------|--------------|
| `useConversations` | localStorage CRUD, hydration, active conversation, `newConversation`, `deleteConversation`, `switchConversation`, `clearMessages` | ~150 |
| `useChatStreaming` | SSE streaming, `sendMessage`, `retrySendMessage`, `abortStream` — shared `sendMessageCore` | ~200 |
| `useTokenCount` | `totalTokens`, `estimateTokens`, token persistence callback | ~50 |
| `useToolCalls` | `pendingToolCalls`, `onToolCall`, `onToolResult`, `withToolResults`, `replayToolCall` | ~80 |
| `useStudioChat` (facade) | Composes all four, exposes original API | ~50 |

### Phase 2: Concurrency Fix

Remove `persistTokens`; single `persist` in `useConversations` called via functional updates only.

### Phase 3: `useCaptcha` Hook

Extract all CAPTCHA state/handlers from `page.tsx`:
- State: `token`, `tokenRef`, `verified`, `error`, `refreshKey`
- Handlers: `onStatus`, `onError`, `retry`, `refreshAndWait`, `setToken`

### Phase 4: Export/Replay Hooks

| Hook | Responsibility |
|------|----------------|
| `useConversationExport` | `handleExportConversation`, `downloadBlob` |
| `useToolReplay` | `handleReplayTool`, composes `useChatStreaming.replayToolCall` |

### Phase 5: Component Decomposition

| Component | Props | Responsibility |
|-----------|-------|----------------|
| `PlaygroundHeader` | `selectedAgent`, `config`, `totalTokens`, `onExport`, `onClear`, `configOpen`, `onToggleConfig` | Top bar |
| `PlaygroundChat` | `selectedAgent`, `messages`, `isStreaming`, `onSend`, `onStop`, `onReplayTool`, `captcha` | Chat area |
| `PlaygroundConfig` | `agents`, `selectedAgent`, `config`, `onChangeConfig`, `onChangeAgent`, `captchaToken`, `configOpen`, `configPanelOpen`, `onToggleConfigPanel` | Sidebar + mobile sheet |
| `PlaygroundLogs` | `logs`, `open`, `onToggle`, `debugVisible`, `onToggleDebug`, `categoryFilter`, `onCategoryFilter` | Logs panel |
| `MobileBar` | `onOpenConversations`, `onOpenConfig`, `onToggleLogs` | Bottom nav |
| `MobileDrawer` | `open`, `onClose`, `conversations`, `activeConversationId`, `onSelect`, `onNew`, `onDelete` | Mobile conversations |
| `MobileBottomSheet` | `open`, `onClose`, `AgentConfigPanel` children | Mobile config |

### Phase 6: Layer Boundaries

ESLint rule: `no-restricted-imports` blocking `_lib/*` in `app/(main)/studio/playground/**` and `app/(main)/studio/_components/**`.

### Phase 7: Security Hardening

- CSP `connect-src` for npm registry
- Rate limit middleware: 30 req/min per IP on studio APIs
- Escape tool results in Markdown export

## Out of Scope

- Changing the `Conversation` type or localStorage schema
- Adding authentication/session management
- Server-side conversation persistence
- WebSocket replacement for SSE
- New agent types or provider integrations

## Acceptance Criteria

### Phase 1
- [ ] All 4 hooks created, each <200 lines
- [ ] `useStudioChat` facade passes existing tests
- [ ] `sendMessage`/`retrySendMessage` share `sendMessageCore` (0 duplication)
- [ ] `npm test` passes (252 unit tests)
- [ ] `npm run test:e2e` passes

### Phase 2
- [ ] No `conversationsRef.current` reads in hot paths
- [ ] Single `persist` via functional `setConversations`
- [ ] No lost updates under concurrent stress test

### Phase 3
- [ ] `page.tsx` CAPTCHA logic reduced to hook usage (~10 lines)
- [ ] `refreshCaptchaAndWait` unit-tested in isolation

### Phase 4
- [ ] `page.tsx` no longer imports `export-conversation`
- [ ] Both hooks unit-tested

### Phase 5
- [ ] `page.tsx` <100 lines
- [ ] Each component <200 lines
- [ ] All e2e tests pass without modification

### Phase 6
- [ ] No `_lib/` imports in presentation layer
- [ ] ESLint rule prevents regression

### Phase 7
- [ ] Rate limiting tested
- [ ] XSS test: tool result with `<script>alert(1)</script>` renders as text

## Testing Strategy

- **Unit:** Each extracted hook tested in isolation (Vitest)
- **Integration:** `useStudioChat` facade tests cover composition
- **E2E:** Existing Playwright tests cover full user flows (captcha, export, replay, responsive)
- **Regression:** All 252 existing unit tests must pass at each phase

## Open Questions

1. **State management pattern** — Use `useReducer` for `useConversations` complex state, or keep `useState` + functional updates?
2. **Compound components vs context** — Explicit props (current) or React Context for `captcha`, `chat`, `config`?
3. **Rate limiting strategy** — IP-based (simple) or user-session-based (requires auth)?
4. **CSP `connect-src` for npm** — Confirm if tool execution actually calls npm registry.
5. **Backward compatibility** — Is `useStudioChat` used outside `page.tsx`? (Current grep: only `page.tsx` and tests)