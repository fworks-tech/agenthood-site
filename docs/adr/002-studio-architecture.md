# ADR-002: Agenthood Studio — browser-based chat and dashboard

**Date:** 2026-06-29
**Status:** Accepted

## Context

The Agenthood project needs a browser-based interface to:
- Allow users to chat with Society members without the CLI
- Demonstrate the agenthood runtime's provider routing in a real UI
- Provide a dashboard for monitoring agent health and activity
- Serve as a proof-of-work for the TypeScript runtime

## Decision

### 1. Server-side provider routing via agenthood runtime

All LLM requests are routed through `agenthood/dist/llm` (the `LLMRouter`). The client never calls provider SDKs directly. This means:

- Provider SDKs (`@anthropic-ai/sdk`, `openai`, `groq-sdk`) are transitive dependencies of `agenthood`, not direct dependencies
- The `LLMRouter` handles provider selection, fallback chain, and credential resolution
- The Studio becomes a consumer and demo of the runtime it documents

### 2. Server-proxied Ollama

Ollama requests are proxied server-side through `/api/studio/chat`. The browser never connects to `localhost:11434` directly. This ensures:

- Consistent rate limiting (Ollama requests are not a bypass path)
- Server-side input validation on all requests
- Structured logging for all provider interactions
- No CORS issues (the browser talks to the same origin)

An `OllamaConnectivityCheck` component provides a client-side reachability indicator (purely informational).

### 3. SSE streaming via NDJSON

The chat API returns a `ReadableStream<Uint8Array>` with NDJSON-encoded events:

```
{"type":"token","data":"Hello"}
{"type":"done"}
{"type":"error","data":"..."}
```

This is not standard SSE (`event:` / `data:` prefixes) — it is a minimal NDJSON protocol. The `readSSEStream` client parses this format. Standard SSE was rejected to avoid the `event:` / `data:` field-splitting overhead and because no EventSource-compatible consumers were needed.

### 4. NDJSON stream client

The `readSSEStream` function in `app/studio/_lib/stream.ts` handles:
- Token-by-token accumulation
- Done signal with deduplication guard (`safeOnDone`)
- Error signal with Error object construction
- AbortSignal propagation for clean cancellation
- Malformed line skipping (bare `catch { continue }`)

### 5. In-memory rate limiting at Edge

Rate limiting is implemented in `app/middleware.ts` using an in-memory `Map<string, { count, resetAt }>` with a maximum of 10,000 entries. This is a development-grade safeguard — it is per-instance on Vercel Edge and does not work across regions. A future iteration should use Upstash Redis or Vercel Edge Config for distributed rate limiting.

### 6. Optional token authentication

The chat API accepts a `STUDIO_API_TOKEN` environment variable. If set, all requests must include `Authorization: Bearer <token>`. If unset, the endpoint is public. This allows the Studio to be deployed without auth for development while supporting token-gating in production.

### 7. Build-time skill sync

Member skill prompts (`SKILL.md` files) are fetched from `fworks-tech/agenthood` main branch at build time via `scripts/sync-skills.mjs`. The generated `app/studio/_data/agents.generated.ts` is a static TypeScript module imported at runtime — no fetch latency, no external dependency during serving.

### 8. localStorage conversation persistence

Chat conversations are saved to `localStorage` under `agenthood-studio-conversations` with:
- Maximum 50 conversations (oldest evicted)
- Maximum 30-day TTL (expired conversations filtered on load)
- Graceful handling of corrupted or full storage

### 9. Structured logging with redaction

The logger in `app/studio/_lib/logger.ts` outputs JSON to stdout with automatic redaction of sensitive fields (`apiKey`, `secret`, `token`, `content`, `message`, `prompt`). This prevents accidental leakage of PII or credentials into log aggregation systems.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Client-side direct SDK calls | Lower latency, no server costs | Exposes API keys to browser, no rate limiting, no logging | Security risk |
| Client-side Ollama direct | No server proxy needed, lower latency | CORS issues, no rate limiting, bypasses validation | Inconsistent security posture |
| Standard SSE (`event:` / `data:`) | Compatible with EventSource API | More parsing overhead, no benefit for single-consumer | Unnecessary complexity |
| External rate limiter (Upstash) | Works across regions, persistent | Additional dependency, cost, cold starts | Over-engineered for MVP |
| Database-backed conversations | Persistent across devices, sessions | Requires database, auth system | Over-engineered for MVP |

## Consequences

- The Studio is an excellent proof-of-work for the agenthood runtime — every chat request exercises the same `LLMRouter` that the CLI uses
- Provider SDK updates are handled by the `agenthood` package, not by the Studio directly
- Ollama users must have the server proxy (no direct browser-to-Ollama path remains)
- The rate limiter's per-instance nature means it is a deterrent, not a guarantee — documented as a known limitation
- Skill prompts are frozen at build time — updates to member skills require a site rebuild
- `scripts/sync-skills.mjs` fetches from the `main` branch of the agenthood repo — a supply-chain consideration documented in the code

## References

- Issue #17: Studio web client specification
- PR #18: Implementation
- agenthood runtime: `agenthood/dist/llm` — LLMRouter, ProviderChain, ProviderFailover
- Existing `scripts/sync-docs.mjs` — established the build-time sync pattern
- ADR-001: Build-time documentation sync
