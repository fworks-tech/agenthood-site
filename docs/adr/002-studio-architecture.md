# ADR-002: Agenthood Studio — browser-based chat and dashboard

**Date:** 2026-06-29
**Last updated:** 2026-07-06
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

### 5. Dual-mode rate limiting at Edge

Rate limiting is implemented in `app/middleware.ts` with two backends:

**Primary:** [Upstash Redis](https://upstash.com) via `@upstash/ratelimit` — sliding window, distributed across instances. Activated when `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars are set (Vercel KV integration or direct Upstash Redis).

**Fallback:** In-memory `Map<string, { count, resetAt }>` with a maximum of 10,000 entries (LRU eviction). Used when no Redis credentials are configured — suitable for development and single-instance deployments.

The middleware probes the environment at startup: if Redis credentials are present, it creates `@upstash/ratelimit` instances per path; otherwise it falls back to the in-memory store. No runtime branching per-request — the backend is chosen once at cold start.

### 6. Origin validation and optional token authentication

The chat API validates the `Origin` header before processing requests. Cross-origin requests are rejected with 403 unless the origin matches `https://agenthood.flabs.tech` (production) or `http://localhost:3000` / `http://127.0.0.1:3000` (development). The origin is parsed to its `origin` form (protocol + hostname) before comparison — string-level starts-with bypasses are not possible.

Additionally, the API accepts a `STUDIO_API_TOKEN` environment variable. If set, all requests must include `Authorization: Bearer <token>`. If unset, the endpoint is public. This allows the Studio to be deployed without auth for development while supporting token-gating in production.

### 7. Build-time skill sync

Member skill prompts (`SKILL.md` files) are fetched from `fworks-tech/agenthood` main branch at build time via `scripts/sync-skills.mjs`. The generated `app/studio/_data/agents.generated.ts` is a static TypeScript module imported at runtime — no fetch latency, no external dependency during serving.

### 8. Client-side persistence strategy

Two storage layers with different scopes:

**Conversations** (localStorage, persistent across sessions):
- Saved under `agenthood-studio-conversations` with maximum 50 conversations (oldest evicted) and 30-day TTL
- Active conversation ID tracked in `agenthood-studio-active-conversation`
- Graceful handling of corrupted or full storage

**Config** (sessionStorage, scoped to tab):
- Saved under `agenthood-studio-config` — cleared when tab is closed
- API key is stripped before saving (`JSON.stringify({ ...cfg, apiKey: undefined })`)
- Config is re-synced via `useEffect` on mount to avoid SSR hydration mismatches (see hydration strategy)

**Feedback** (localStorage, persistent):
- Per-message thumbs up/down stored under `agenthood-studio-feedback`

### 9. Structured logging with redaction

The logger in `app/studio/_lib/logger.ts` outputs JSON to stdout with automatic redaction of:

**Sensitive keys:** `apiKey`, `secret`, `token`, `authorization`, `content`, `message`, `prompt` (covers all casing variants via `.toLowerCase()` matching)

**Value patterns:** `sk-` prefixed API keys, `Bearer`/`bearer` tokens (case-insensitive regex), PEM private keys (`-----BEGIN ... PRIVATE KEY-----`), URL strings

The sanitizer is recursive (up to 5 levels deep) to handle nested metadata objects, arrays, and mixed structures.

### 10. SSRF protection

The chat API route (`app/api/studio/chat/route.ts`) validates all custom `baseUrl` values before proxying:

- **Protocol restriction:** Only `http:` and `https:` are accepted. Other protocols (file:, ftp:, dict:, gopher:) are rejected.
- **HTTP restriction:** `http://` URLs are only allowed for `localhost`, `127.0.0.1`, and `host.docker.internal` — blocking SSRF to internal network hosts.
- **HTTPS unrestricted:** Any `https://` host is allowed. TLS certificate validation provides endpoint authenticity.
- **Cloud provider block:** Anthropic, OpenAI, and Groq reject `baseUrl` entirely — they must use the default API endpoint.

This is enforced before any provider library is instantiated, preventing SSRF via malicious config injection.

### 11. Content Security Policy

A `Content-Security-Policy` header is applied to all routes via `next.config.ts`:

| Directive | Sources |
|-----------|---------|
| `default-src` | `'self'` |
| `script-src` | `'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com` |
| `style-src` | `'self' 'unsafe-inline'` |
| `img-src` | `'self' data: blob:` |
| `font-src` | `'self' data:` |
| `connect-src` | `'self' https://opencode.ai https://api.anthropic.com https://api.openai.com https://api.groq.com https://o4508931134267392.ingest.us.sentry.io` |
| `frame-src` | `https://challenges.cloudflare.com` |
| `object-src` | `'none'` |
| `base-uri` | `'self'` |
| `form-action` | `'self'` |

The `connect-src` directive covers the known provider API endpoints and the Sentry ingest URL. Ollama URLs (`http://localhost:11434`) are not listed because they are user-configurable and dynamic — CSP violations are non-blocking warnings in this context.

### 12. Model validation

The chat API builds a `KNOWN_MODELS` set from `PROVIDER_MODELS` at startup and validates all `model` values before forwarding to the provider:

```typescript
const KNOWN_MODELS = new Set(
  Object.values(PROVIDER_MODELS).flatMap((meta) => meta.models.map((m) => m.id)),
);
```

Unknown model IDs trigger a `ValidationError` with status 400. This prevents:
- Model injection via manipulated client payloads
- Typos causing unexpected provider behavior
- Deprecated model IDs that no longer exist at the provider

### 13. Hydration strategy

The Studio is a `"use client"` component that reads from localStorage/sessionStorage. On the server (SSR), storage reads return empty defaults (`[]`, `null`, `{}`). This causes React hydration mismatches when the client immediately renders with real storage data.

The fix moves all storage reads from `useState` initializers to `useEffect`:

```typescript
// Before (hydration mismatch)
const [conversations, setConversations] = useState(loadConversations);

// After (matches SSR)
const [conversations, setConversations] = useState([]);
useEffect(() => {
  setConversations(loadConversations());
}, []);
```

A `hydrated` boolean flag prevents the `ConversationList` from rendering until data is loaded, eliminating the visual flash of "0 conversations" turning into "N conversations." The same pattern is applied to config restoration from sessionStorage.

### 14. Server-side tool execution loop

The Studio supports two tools that agents can use during chat: `web_fetch` and `code_execution`.

**Tool definitions** live in `app/studio/_lib/tools.ts`:

| Tool | Schema | Execution |
|------|--------|-----------|
| `web_fetch` | `url: string` (required) | Fetches URL content via HTTPS. Allowed hosts: `github.com`, `raw.githubusercontent.com`, `gist.github.com`. Strips HTML, returns text. 15s timeout, 100KB limit. |
| `code_execution` | `code: string` (required) | Runs JavaScript in sandboxed `node:vm` with 5s timeout. Returns JSON-stringified result. |

**Agentic loop** in `app/studio/_lib/agenthood-adapter.ts`:

When tools are enabled, the adapter switches from `stream()` to `complete()` for the tool execution phase:

1. Call `provider.complete()` with `tools` in the request
2. If the response includes `toolCalls`, execute each tool server-side
3. Append tool results as new `role: "tool"` messages
4. Repeat up to 5 iterations (`MAX_TOOL_ITERATIONS`)
5. Once no more tool calls are requested, stream the final text response as character-level tokens

After the tool loop, the final text is streamed character-by-character (with `tool_call` and `tool_result` events sent first) so the client can display tool usage before the response text appears.

**Streaming protocol extension.** Two new NDJSON event types were added:

| Event | Payload | Purpose |
|-------|---------|---------|
| `tool_call` | `{ id, name, args }` | Informs the client that a tool was invoked |
| `tool_result` | `{ id, name, result, error? }` | Provides the tool's output or error |

**Client-side handling.** The `readSSEStream` parser dispatches these to `onToolCall`/`onToolResult` callbacks. The `useStudioChat` hook accumulates `ToolCallInfo` objects on the assistant message, and `MessageBubble.tsx` renders each tool call as a compact status badge (green checkmark for success, red X for error, spinner for pending).

**UI toggle.** The AgentConfigPanel includes a "Tools & Capabilities" section with checkboxes for each tool. Tool enablement is transmitted as `config.enabledTools` in the chat request body.

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Client-side direct SDK calls | Lower latency, no server costs | Exposes API keys to browser, no rate limiting, no logging | Security risk |
| Client-side Ollama direct | No server proxy needed, lower latency | CORS issues, no rate limiting, bypasses validation | Inconsistent security posture |
| Standard SSE (`event:` / `data:`) | Compatible with EventSource API | More parsing overhead, no benefit for single-consumer | Unnecessary complexity |
| External rate limiter (Upstash) | Works across regions, persistent | Additional dependency, cost, cold starts | Implemented with in-memory fallback — Redis when available, Map otherwise |
| Database-backed conversations | Persistent across devices, sessions | Requires database, auth system | Over-engineered for MVP |

## Consequences

- The Studio is an excellent proof-of-work for the agenthood runtime — every chat request exercises the same `LLMRouter` that the CLI uses
- Provider SDK updates are handled by the `agenthood` package, not by the Studio directly
- Ollama users must have the server proxy (no direct browser-to-Ollama path remains)
- The rate limiter uses Upstash Redis when available, falling back to per-instance in-memory — distributed rate limiting requires KV to be provisioned
- Config is scoped to the browser tab (sessionStorage) — user preferences are lost when the browser closes, but API keys are never persisted (stripped before save)
- SSRF protection guards against malicious `baseUrl` injection — only localhost http:// and any https:// are allowed
- CSP blocks inline script execution and restricts resource loading to known origins
- Model validation catches typos and injection attempts before they reach the provider SDK
- Hydration strategy uses `useEffect` + `hydrated` flag to prevent SSR/CSR mismatches — no console hydration errors in production
- Skill prompts are frozen at build time — updates to member skills require a site rebuild
- `scripts/sync-skills.mjs` fetches from the `main` branch of the agenthood repo — a supply-chain consideration documented in the code

## References

- Issue #17: Studio web client specification
- PR #18: Implementation
- Issue #33: Playground hardening — audit fixes, security, hydration, rate limiting, lint cleanup
- agenthood runtime: `agenthood/dist/llm` — LLMRouter, ProviderChain, ProviderFailover
- Existing `scripts/sync-docs.mjs` — established the build-time sync pattern
- ADR-001: Build-time documentation sync
