# ADR-006: Tool execution replay via a dedicated endpoint

**Date:** 2026-08-25
**Status:** Accepted

## Context

Studio tool calls were captured in the conversation model but were not truthful or resumable:

- `runToolLoop` always emitted `error: undefined` on `tool_result`, even for a tool whose handler
  returned an `Error: …` string, so every call rendered `complete`.
- There was no way to re-run a failed tool: tools execute server-side (Node `fetch` with an
  allow-list, `node:vm` sandbox) and had no standalone entry point.
- Tool history was only persisted at stream end, so a tab closed mid-stream lost executed calls.
- Tool calls carried no timing information for the history view.

## Decision

1. **Truthful classification:** tool results starting with `Error: ` are split into a structured
   `error` field (`classifyToolResult` in `_lib/tools.ts`); the LLM-visible `role: "tool"`
   content stays unchanged.
2. **Replay scope:** replay re-executes only the tool with its recorded args and patches the
   result back into the message via a pure reducer (`_lib/tool-outcome.ts`). It does **not**
   re-run the LLM turn, so it is cheap and deterministic for the user.
3. **New endpoint:** `POST /api/studio/tools/execute` accepts `{ tool, args, turnstileToken }`,
   validates against the same allow-list/sandbox handlers (`executeTool`), and returns
   `{ result }` or `{ error }`. It reuses the captcha gate extracted to `_lib/captcha.ts`, and
   the middleware now rate-limits (`/api/studio/tools`, 30/min) and origin-checks it, matching
   the chat route's posture.
4. **History:** `ToolCallInfo` gains `startedAt`/`completedAt`/`durationMs`; tool results are
   persisted incrementally (on `tool_result`, not only at stream end).

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Re-run the whole assistant turn on replay | LLM can regenerate a new answer and retry itself | Costs tokens; may produce a different answer; async/stream UX | Issue asks to replay the *tool*, not the turn |
| Client-side tool execution | No new endpoint | web_fetch/code_execution are server-side (Node fetch, `node:vm`); would duplicate policy and sandbox client-side | Incorrect by construction |
| Reuse the chat route with a `replay` flag | One endpoint | Captcha + rate limiting already keyed per-route; tools don't need the tool loop, and a reused chat route would imply LLM invocations | New endpoint is simpler and has a tighter attack surface |

## Consequences

- **Easier:** failed tools are visible and replayable; history survives mid-stream closes; the
  execute endpoint has an explicit security contract.
- **Harder:** one more public route to maintain; the `Error:`-prefix heuristic is the failure
  contract between handlers and transport (documented where handlers return errors).
- **Risk:** a bot could repeatedly trigger `code_execution` — bounded by the existing 30/min
  rate limit, origin validation, Turnstile, and the 5s VM timeout.

## References

- Issue fworks-tech/agenthood-site#42; `_lib/tools.ts`, `_lib/agenthood-adapter.ts`,
  `_lib/tool-outcome.ts`, `_lib/captcha.ts`, `app/api/studio/tools/execute/route.ts`,
  `app/middleware.ts`, `_hooks/useStudioChat.ts`, `_components/MessageBubble.tsx`. ADR-005 for
  the shared Turnstile gate.