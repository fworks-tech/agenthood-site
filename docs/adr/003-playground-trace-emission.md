# ADR-003: Playground trace emission via structured logs

**Date:** 2026-08-15
**Status:** Accepted

## Context

The M7 exit criterion requires every member invocation to produce a cost + quality trace. The Studio playground invokes members through `LightweightAdapter` (`app/(main)/studio/_lib/agenthood-adapter.ts`), which drives `LLMRouter` directly and bypasses the runtime's `BaseAgent`/tracer path — so playground chats produced no traces at all.

The site runs on Vercel's serverless runtime: instances are short-lived and per-instance memory is not a durable store, which rules out the runtime's in-memory ring-buffer tracer as a persistence mechanism. The site already has a structured logger with recursive redaction (`app/(main)/studio/_lib/logger.ts`) whose output lands in Vercel Logs.

Issue fworks-tech/agenthood-site#70 (agenthood M7 remainder) asks for playground traces with `source: "playground"` and correlation between browser sessions and server-side traces via `X-Correlation-Id`.

## Decision

1. **Emit the trace envelope through the site's structured logger.** `LightweightAdapter` builds a `TraceEnvelope` via `createTraceEnvelope` (`agenthood/dist/core`) with `source: "playground"` and logs it as a `trace` event. The envelope carries `input`, `output`, `durationMs`, estimated `tokenCount`, `cost` (via `estimateCostFromTokens`), `qualityScore: null`, and the `correlationId`.

2. **Correlation via `X-Correlation-Id`.** `POST /api/studio/chat` accepts an optional `X-Correlation-Id` header (validated: trimmed, ≤128 chars, no control characters), falls back to a generated id, passes it to the adapter, and echoes it in the response headers. The playground client (`useStudioChat`) sends a fresh id per invocation so LiveLogs can link browser sessions to server traces.

3. **Token counts are estimated from characters.** The adapter streams text without provider usage stats, so `tokenCount` is estimated at 4 chars/token — counting the system prompt (the full agent skill) plus all user/assistant message content for input, and streamed characters for output. `cost` follows from the pricing table lookup. `qualityScore` stays `null` — no baseline data exists in the site runtime. The envelope's `input`/`output` payloads are bounded to 8,000 chars each so Vercel log lines stay queryable and untruncated.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Agenthood in-memory ring-buffer tracer | Matches runtime semantics; zero extra plumbing | Ephemeral in serverless; lost between invocations and instances | Cannot satisfy "every invocation produces a trace" observably |
| HTTP push to a trace endpoint | Structured collection; queryable | Requires a persistent store (KV/DB) and new API surface | Scope far beyond the issue; Vercel Logs already searchable |
| No client-side correlation id | Simpler | Browser session cannot link to server traces | Issue explicitly requires the link |

## Consequences

- Traces live in Vercel Logs as structured `trace` events, searchable by `correlationId` or `member`.
- Envelope payloads pass through the redacting logger — secret-shaped strings (`sk-...`, bearer tokens, URLs) are redacted before logging.
- `qualityScore` and token counts are approximations; replay-grade fidelity is out of scope for the playground.
- The dependency was bumped `agenthood` 3.13.6 → 3.33.0, which is where `createTraceEnvelope`'s `source` field and `estimateCostFromTokens` were added.

## References

- Issue fworks-tech/agenthood-site#70
- agenthood ADR-015 (decision intelligence and provenance) and `src/core/TraceEnvelope.ts`
- Existing structured logger: `app/(main)/studio/_lib/logger.ts`
