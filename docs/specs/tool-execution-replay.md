# Spec: Tool execution history and replay

## Problem

Tool calls (args/results) were already captured per conversation but not truthful or resumable:
every call rendered `complete` because the server never set `error`, there was no expandable
view, failed tools could not be re-run, and history was lost if a tab closed mid-stream.

## Proposed Solution

1. **Server-side classification:** `classifyToolResult` splits `Error: …` results into a
   structured `error` (`_lib/tools.ts`), applied in `runToolLoop` so the emitted `tool_result`
   is accurate; the LLM-visible tool content is unchanged.
2. **History:** `ToolCallInfo` gains `startedAt`/`completedAt`/`durationMs`; tool results are
   persisted incrementally on each `tool_result`.
3. **Expandable log:** `MessageBubble` renders each tool call as a collapsible card (status,
   duration, args as JSON, result, error) with a **Retry tool** action on failures.
4. **Replay:** `POST /api/studio/tools/execute` re-executes only the tool with its recorded
   args (same handlers as the chat tool loop) and returns `{ result }`/`{ error }`. A pure
   reducer (`applyToolReplayOutcome`) patches the message. `useStudioChat.replayToolCall`
   drives it; the page wires the UI.
5. **Security:** the shared `validateTurnstile` (extracted to `_lib/captcha.ts`) gates the new
   route; the middleware adds a 30/min rate-limit bucket and origin validation for
   `/api/studio/tools`, with trailing-slash-normalized bucket keys (fixing the same gap for the
   chat/agents buckets).

## Out of Scope

- Re-running the full LLM turn on replay (tool-only by design, ADR-006).
- New tools or changed sandbox rules.
- Server-side conversation storage.

## Acceptance Criteria

- [ ] Failed tools (`Error: …` results) render as `error` end-to-end (server → client)
- [ ] Tool calls carry `startedAt`/`completedAt`/`durationMs` and survive a mid-stream close
      (persist on `tool_result`)
- [ ] Tool log is expandable: args, result, error, duration all visible; a `Retry tool` action
      on failures re-executes via `/api/studio/tools/execute` and the entry flips to complete
      with the fresh result (or stays error with the fresh message)
- [ ] `/api/studio/tools/execute` validates `tool`/`args`, requires Turnstile when enabled, is
      rate-limited (30/min) and origin-checked
- [ ] Unit: reducer (`__tests__/tool-replay.test.ts`), classification, route, middleware
- [ ] E2E: expandable error tool call + replay round-trip (`e2e/tools.spec.ts`)
- [ ] Lint, unit tests, and full e2e pass

## Testing Strategy

- **Unit:** `classifyToolResult`, `applyToolReplayOutcome` (success/error/no-op), route
  validation (already bounded by `tools.test.ts` guards), middleware buckets + origin guard.
- **E2E:** mocked SSE emits a failing `tool_result`; assert expandable error card; mock
  `/api/studio/tools/execute/`; click Retry; assert the entry updates and the request carried
  the recorded args + token.

## Open Questions

None — ADR-006 records the tool-only replay decision and endpoint security posture.