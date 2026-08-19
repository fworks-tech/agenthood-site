# ADR-004: Client-side log model and SSE-gated network telemetry for Studio Live Logs

**Date:** 2026-08-18
**Status:** Accepted

## Context

The Studio playground's LiveLogs panel was a closed circuit: ad-hoc `{time, level, message}`
entries, only three levels (info/warn/error), no categories, no stable identity, no
persistence across reloads, and no visibility into the server-side path. ADR-003 established
`X-Correlation-Id` so browser sessions could link to server traces in Vercel Logs, but the
client never surfaced request IDs, provider routing, durations, or token counts. Two pain
points made this concrete:

- The CAPTCHA failure (issue #89) showed a symptom line ("CAPTCHA verification timed out")
  with no lifecycle — the panel could not tell whether the script loaded, a challenge was
  required, or the token was re-acquired.
- When a chat request failed (rate limit, provider error), the panel showed "failed after Xs"
  with no HTTP status and no `X-Request-Id`/`X-Correlation-Id` to correlate with Vercel Logs.

## Decision

1. **Typed log model.** Introduce `LogLevel = "debug" | "info" | "warn" | "error"` and
   `LogCategory` (`system | captcha | agent | message | config | conversation | network`) in
   `app/(main)/studio/_lib/log-types.ts`. `LogEntry` gains `id`, `ts`, `category`, and optional
   `detail` (e.g. a correlation id). Existing message-based call sites remain valid; the level
   union is backward compatible.

2. **Session persistence.** A small store (`_lib/log-store.ts`) caps entries at 200 and persists
   to `sessionStorage` under `agenthood-studio-logs`. Persistence stretches to across navigations
   only (not across tabs/sessions), consistent with the existing `sessionStorage` config
   precedent in ADR-002-era code.

3. **Server telemetry via a new SSE `log` event.** The server-side adapter (`LightweightAdapter`)
   already logs structured events (chat.routing, chat.complete, chat.aborted, chat.error, trace).
   Each of these sites now also enqueues a `{type: "log", level, event, ...meta}` SSE event into
   the chat stream. The stream parser (`_lib/stream.ts`) gains an optional `onLog` callback; the
   hook (`useStudioChat`) forwards it through an optional `onLog` option; the playground routes it
   into LiveLogs under `category: "network"` with the correlation id in `detail`.

4. **Client-safe meta allowlist.** Bridged `log` events forward only non-sensitive fields (event
   name, level, agentId, provider, durationMs, token counts, correlationId). Message content,
   prompts, and raw error strings are **never** forwarded — the client already receives the
   human-safe error via the existing `error` SSE event. `pickSafeLogMeta` in `_lib/logger.ts` is
   the single source of truth for the allowlist.

5. **No protocol break.** Existing clients ignore unknown SSE event types (the parser's switch
   has no matching case), and an old server that never emits `log` events is unaffected. The
   change is strictly additive.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Header-only correlation (X-Request-Id / X-Correlation-Id from response headers) | Small change; no protocol surface | Carries no routing/providers/token counts after the stream starts; misses mid-stream server errors; duplicates a second mechanism | Delivers only status+ids, not the richer lifecycle we need; rejected in favor of SSE |
| Duplicate console logs to a client poll endpoint | No SSE surface | Polling adds latency and a new API; serverless instances are ephemeral | Fragile and indirect |
| In-memory only, no persistence | Simplest | Loses diagnostics on refresh — the exact gap behind issue (log model) | Rejected; sessionStorage is cheap and already the site convention |

## Consequences

- `LiveLogs` becomes a structured observability surface: debug level, categories, filtering,
  copy, auto-expand (Concern D) all build on the model from this ADR.
- Server↔client correlation is finally visible in the UI: a user can paste one correlation id
  into Vercel Logs to see the full server trace (ADR-003's link, now complete).
- Adding a new bridged field later requires touching `pickSafeLogMeta` — a single enforced
  place where redaction policy lives.
- `sessionStorage` evicts on tab close; long-lived debugging across browser restarts is out of
  scope (Vercel Logs remains the durable sink).

## References

- Issues fworks-tech/agenthood-site#90, #91, #92, #93
- ADR-003 (playground trace emission via structured logs) — the correlation link this completes
- `app/(main)/studio/_lib/logger.ts` (redaction source), `_lib/stream.ts` (SSE parser),
  `_lib/agenthood-adapter.ts` (server event sites), `_components/LiveLogs.tsx` (UI)
