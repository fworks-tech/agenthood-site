# ADR-008: Playground monolith decomposition into hooks and components

**Date:** 2026-08-29
**Status:** Accepted

## Context

The `PlaygroundPage` component (`app/(main)/studio/playground/page.tsx`) has grown to ~970 lines and contains:
- 25+ `useState`/`useRef` declarations for CAPTCHA, config, logs, mobile UI, conversations, etc.
- 15+ `useEffect` hooks for hydration, persistence, logging, responsive behavior
- 12+ `useCallback` handlers for send/retry, CAPTCHA, export, replay, config, agent selection
- Direct imports from `_lib/stream`, `_lib/log-store`, `_lib/export-conversation` (layer violations)

The `useStudioChat` hook (`app/(main)/studio/_hooks/useStudioChat.ts`) is ~600 lines with:
- Duplicated `sendMessage`/`retrySendMessage` (≈300 lines each, 95% identical)
- Concurrency race in `persistTokens` reading `conversationsRef.current` while functional updates use stale closures
- Mixed responsibilities: persistence, streaming, token counting, tool call tracking

## Decision

Decompose the monolith in phased branches:

1. **Extract `useStudioChat` into 4 focused hooks** (stacked branch):
   - `useConversations` — localStorage CRUD, hydration, active conversation tracking
   - `useChatStreaming` — SSE handling, shared `sendMessageCore` eliminates send/retry duplication
   - `useTokenCount` — token estimation, `totalTokens` state
   - `useToolCalls` — tool call tracking, pending results, replay integration

2. **Fix concurrency race** (stacked on #1): Remove `persistTokens`; single persistence path via functional updates in `useConversations`.

3. **Extract `useCaptcha` hook** (stacked on #1): All CAPTCHA state/logic (token, verified, error, refresh, retry) moved out of `page.tsx`.

4. **Extract `useConversationExport` and `useToolReplay` hooks** (stacked on #1): Move export/replay logic out of `page.tsx`, behind hook APIs.

5. **Decompose `PlaygroundPage` into 7 components** (stacked on #1-4):
   - `PlaygroundHeader` — agent badge, token count, export menu, clear button
   - `PlaygroundChat` — `MessageList` + `ChatComposer` + welcome state
   - `PlaygroundConfig` — desktop sidebar + mobile bottom sheet (agent config)
   - `PlaygroundLogs` — `LiveLogs` + `DragHandle`
   - `MobileBar` — fixed bottom nav (Conversations/Config/Logs)
   - `MobileDrawer` — conversations drawer (mobile)
   - `MobileBottomSheet` — config sheet (mobile)
   - `page.tsx` becomes ~50-line composition shell

6. **Enforce layer boundaries** (stacked on #5): Presentation layer (`page.tsx`, `_components/`) may only import from `_hooks/`, `_components/`, `_types/`, external packages — no `_lib/` imports.

7. **Security hardening** (parallel, independent):
   - CSP `connect-src` for npm registry if tool execution needs it
   - Rate limiting on `/api/studio/chat` and `/api/studio/tools/execute`
   - Markdown sanitization for tool results in export

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Single large refactor PR | Atomic | Unreviewable; high conflict risk; no incremental validation | One concern per branch is the standard |
| `useReducer` for all state | Centralized logic | Overhead for simple state; existing `useState` patterns work | Incremental extraction preserves patterns |
| Context for cross-component state | Cleaner props | Adds indirection; current prop drilling is explicit and testable | Explicit composition preferred |
| Keep `_lib` imports in components | Less change | Violates architecture; `_lib` is server/infra, not UI | Layer boundary is a hard rule |

## Consequences

- **Easier:** Each hook <200 lines, single responsibility, unit-testable in isolation; components <200 lines; page.tsx readable; no send/retry duplication; no concurrency race; layer boundaries enforced.
- **Harder:** More files to navigate; stacked branches require rebasing.
- **Risk:** Behavioral regression during extraction — mitigated by existing 252 unit tests + e2e tests running at each phase.

## References

- Issue fworks-tech/agenthood-site#135 (footer version source — precedent for stacked branches)
- ADR-002 (studio architecture), ADR-006 (tool replay), ADR-007 (captcha hardening)
- `app/(main)/studio/playground/page.tsx`, `app/(main)/studio/_hooks/useStudioChat.ts`
- `docs/specs/playground-decomposition.md`, `docs/specs/use-chat-hooks-extraction.md`