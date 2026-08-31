# agenthood-site

> The marketing site for [Agenthood](https://github.com/fworks-tech/agenthood) — a society of AI agents with impeccable standards and zero tolerance for `fix stuff` commits.

Live at **[agenthood.flabs.tech](https://agenthood.flabs.tech)**

---

## What's here

| Route | Content |
|-------|---------|
| `/` | Landing page — agents, how it works, GitHub link |
| `/academy/` | Academy — educational articles (synced from agenthood repo) |
| `/adr/` | Architecture Decision Records from the agenthood repo |
| `/docs/*` | Docs pages with floating companion (The Oracle) for inline assistance |
| `/getting-started/` | Getting started guide with floating companion |
| `/studio` | Agenthood Studio — chat with Society members, dashboard |
| `/studio/playground` | Interactive chat playground with agent config panel and tools (web fetch, code execution) |
| `/studio/dashboard` | Runtime dashboard: KPI cards, agent status, activity feed |
| `/studio/workspaces` | Multi-agent workspaces — pick several Society members (The Mediator auto-included as conductor), give one instruction, and watch them plan → act → retry → handoff in a live shared thread (SSE `workspace.*` events, turn budget, human checkpoints) |
| `/releases` | Release notes (synced from agenthood repo) |

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Deployment | Vercel |
| Test runner | Vitest |
| LLM routing | agenthood runtime (`agenthood/dist/llm`) |

---

## Studio Architecture

The Studio is a browser-based proof-of-work for the agenthood runtime (pinned to the
installed `agenthood` package — see `app/_lib/agenthood-version.ts`, the single source of
truth for the version shown by the Footer badge and referenced here). It allows users to chat with any of the 20 Society members through a configurable provider backend.

### API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/studio/chat` | SSE-streamed chat with an agent |
| POST | `/api/studio/workspaces` | SSE-streamed workspace run — Mediator intake + turn scheduler over selected members (shared thread, `workspace.*` events) |
| GET | `/api/studio/agents` | List all Society members |
| GET | `/api/studio/status` | Runtime health (agents online, KV connectivity, errors, activity) |

### Authentication

The Studio API is protected by Cloudflare Turnstile CAPTCHA (chat), rate limiting, and origin validation. No token-based auth is required — the endpoint is public by design.

### Provider Routing

All LLM requests are routed server-side through the agenthood `LLMRouter`. The provider chain is:

1. User-selected provider (from the client config; defaults to OpenCode)
2. Groq (fallback if primary fails)
3. OpenAI (fallback)
4. Ollama (local fallback)

Ollama requests are proxied server-side — the browser never connects directly to localhost. This ensures consistent rate limiting, input validation, and logging across all providers.

**SSRF Protection:** Custom `baseUrl` values are validated server-side. `http://` URLs are restricted to `localhost`, `127.0.0.1`, and `host.docker.internal`. `https://` URLs are unrestricted (TLS validates the endpoint). Cloud providers (Anthropic, OpenAI, Groq) reject `baseUrl` entirely.

**Model Validation:** Model IDs are validated server-side against a known set (`PROVIDER_MODELS` in `studio.ts`). Unknown model IDs trigger a `ValidationError` before any provider call.

**Supported providers:** Anthropic, OpenAI, Groq, OpenRouter, Ollama (local), OpenCode Zen, OpenCode Go (local/cloud)

### Rate Limiting

Sliding-window rate limiter at the Edge middleware layer with dual-mode backend:

**Primary:** [Upstash Redis](https://upstash.com) (distributed, persists across instances) — used when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
**Fallback:** In-memory `Map<string, { count, resetAt }>` capped at 10,000 entries with LRU eviction — used when KV is not configured

| Path | Limit | Window |
|------|-------|--------|
| `/api/studio/chat` | 20 req/min | 60s |
| `/api/studio/workspaces` | 20 req/min | 60s |
| `/api/studio/agents` | 60 req/min | 60s |
| `/api/studio/status` | 30 req/min | 60s |

Origin validation is performed before rate limiting — cross-origin requests to `/api/studio/chat` are rejected with 403 unless the origin matches `https://agenthood.flabs.tech` (production) or `http://localhost:3000` / `http://127.0.0.1:3000` (development).

### Security Headers

Applied to all routes via `next.config.ts`:

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com`; `connect-src 'self' https://opencode.ai https://api.anthropic.com https://api.openai.com https://api.groq.com https://openrouter.ai/api https://o4508931134267392.ingest.us.sentry.io`; `frame-src https://challenges.cloudflare.com` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENCODE_API_KEY` | Default provider | OpenCode API key — powers the zero-setup default (opencode-go) visitors use to chat in the Studio without configuring a key |
| `ANTHROPIC_API_KEY` | For Anthropic | Claude API key |
| `OPENAI_API_KEY` | For OpenAI | GPT API key |
| `GROQ_API_KEY` | For Groq | Groq API key |
| `OPENROUTER_API_KEY` | For OpenRouter | OpenRouter API key |
| `OLLAMA_HOST` | For Ollama | Self-hosted Ollama endpoint (default `http://localhost:11434`) |
| `KV_REST_API_URL` | For Upstash | Redis REST API URL for distributed rate limiting |
| `KV_REST_API_TOKEN` | For Upstash | Redis REST API token for distributed rate limiting |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | For CAPTCHA | Cloudflare Turnstile site key |
| `TURNSTILE_SECRET_KEY` | For CAPTCHA | Cloudflare Turnstile secret key |
| `NEXT_PUBLIC_TURNSTILE_ENABLED` | For CAPTCHA | Single source of truth; set `false` to disable CAPTCHA client+server (default enabled) |
| `NEXT_PUBLIC_SENTRY_DSN` | For Sentry | Sentry Data Source Name for error tracking |
| `SENTRY_ORG` | Optional | Sentry organization slug (defaults to `fworks`) |
| `SENTRY_PROJECT` | Optional | Sentry project slug (defaults to `agenthood-site`) |

### Studio Code Layout

```
app/(main)/studio/
├── playground/
│   ├── page.tsx                    Chat playground (composition shell, ~429 lines)
│   └── _components/
│       ├── PlaygroundHeader.tsx    Agent badge, token count, export menu, clear button
│       ├── PlaygroundSidebar.tsx   Desktop: agent config + conversations + logs
│       ├── PlaygroundChatArea.tsx  MessageList + ChatComposer + welcome state
│       ├── MobileNavBar.tsx        Mobile bottom nav (Conversations/Config/Logs)
│       ├── AnimatedMessage.tsx     Animated assistant message
│       └── WelcomeTerminal.tsx     Welcome / empty state
├── workspaces/
│   ├── page.tsx                    Workspaces (member picker → 3-zone live thread)
│   └── _components/
│       ├── WorkspaceComposer.tsx   Member multi-select + instruction input
│       ├── WorkspaceChatArea.tsx   Live shared thread (per-member bubbles)
│       ├── WorkspaceSidebar.tsx    Agent status cards (idle→thinking→working→done)
│       └── WorkspaceTurnCard.tsx   One member's turn: plan → act → result
├── layout.tsx                      Studio layout
├── error.tsx / loading.tsx         Error/loading boundaries
├── _components/                    Shared Studio components
│   ├── AgentConfigPanel.tsx        Agent selection + config controls
│   ├── ChatComposer.tsx            Message input
│   ├── ConversationList.tsx        Conversation sidebar list
│   ├── DragHandle.tsx              Resizable panel divider
│   ├── HelpTip.tsx                 (?) tooltip component
│   ├── LiveLogs.tsx                Event log panel
│   ├── MessageList.tsx             Chat message container
│   ├── MessageBubble.tsx           Individual message with feedback
│   ├── MobileBottomSheet.tsx       Mobile config sheet
│   ├── MobileDrawer.tsx            Mobile conversation drawer
│   └── OllamaConnectivityCheck.tsx Local Ollama reachability
├── _hooks/
│   ├── useStudioChat.ts            Chat state + streaming + persistence (core)
│   ├── useWorkspace.ts             Workspace state machine + SSE `workspace.*` handling (client-driven turn loop)
│   ├── useAgentDirectory.ts        Agent list fetch
│   ├── useCaptcha.ts               CAPTCHA token/verified latch + refreshAndWait
│   ├── useLogs.ts                  Live log store + SSE telemetry
│   ├── useConversationExport.ts    JSON/Markdown export + download
│   └── useToolReplay.ts            Tool execution replay + duration tracking
├── _lib/
│   ├── agenthood-adapter.ts        LLMRouter wrapper → ReadableStream, tool loop
│   ├── workspace-adapter.ts        Workspace orchestrator adapter (member scheduling → SSE)
│   ├── workspace-orchestrator.ts   Turn scheduler + stop budget + handoff + thread trimming
│   ├── captcha.ts                  Server-side Turnstile verification (fail-closed when required)
│   ├── constants.ts                LocalStorage/SessionStorage key constants
│   ├── env.ts                      TURNSTILE_ENABLED / TURNSTILE_REQUIRED
│   ├── errors.ts                   StudioError hierarchy
│   ├── export-conversation.ts      Conversation serialization (sanitized code fences)
│   ├── log-store.ts                In-memory log buffer
│   ├── logger.ts                   Structured JSON logging with redaction
│   ├── stream.ts                   NDJSON/SSE stream reader (token, tool_call, tool_result)
│   ├── studio-api.ts               Client-side fetch wrappers
│   └── tools.ts                    Tool definitions (web_fetch, code_execution)
├── _data/
│   ├── agents.ts                   Agent registry — canonical fields from upstream registry.json, site-only presentation config
│   ├── registry.generated.ts       Auto-generated from upstream docs/members/registry.json
│   ├── agents.generated.ts         Auto-generated skill prompts
│   └── agentPrompts.generated.ts   Auto-generated When-to-Use prompt hints
├── _types/
│   ├── studio.ts                   TypeScript types for providers, config
│   └── workspace.ts                WorkspaceSpec / WorkspaceTurn / WorkspaceEvent types
└── api/studio/workspaces/
    └── route.ts                    POST /api/studio/workspaces (SSE, validation, rate limit)
```

---

## Testing

### Unit tests (Vitest)

```bash
npm test               # run all unit tests
npm run test:watch     # watch mode
```

| File | Tests | What it covers |
|------|-------|----------------|
| `errors.test.ts` | 8 | Error hierarchy, status codes, instanceof checks |
| `stream.test.ts` | 7 | SSE parsing, token events, tool_call/tool_result events, error events, abort, malformed data, double-onDone guard |
| `logger.test.ts` | 4 | Secret redaction (apiKey, authorization, tokens), sanitization accuracy |
| `adapter.test.ts` | 8 | Provider routing, model selection, abort, error handling |

### E2E tests (Playwright)

```bash
npx playwright test                # run all 106 tests across chromium + mobile
npx playwright test --project=mobile  # mobile-only (iPhone 13)
npx playwright test --debug         # interactive debug mode
```

| Test file | Tests | What it covers |
|-----------|-------|----------------|
| `config.spec.ts` | 7 | Provider/model select, slider sync, save/restore, API key input |
| `conversations.spec.ts` | 5 | Create, switch, delete, auto-title, persist across reload |
| `errors.spec.ts` | 3 | Log entries for streaming, errors, abort, config save |
| `playground.spec.ts` | 8 | Agent selection, send/stream messages, token counter, clear, code agent hint |
| `responsive.spec.ts` | 5 | Mobile overlay, desktop side-by-side, toggle, backdrop |
| `companion.spec.ts` | 18 | Floating companion visibility, quick actions, close/expand, mobile layout |

The E2E suite uses Cloudflare Turnstile test keys (`1x00000000000000000000AA`) to bypass CAPTCHA, and SSE route interception to mock provider responses.

---

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The `predev` script runs `sync-docs.mjs`, `sync-news.mjs`, and `sync-skills.mjs` to fetch latest content from the agenthood repo. Requires network access to `raw.githubusercontent.com`.

---

## Architecture Decision Records

- **ADR-001** — Build-time documentation sync (`docs/adr/001-build-time-docs-sync.md`)
- **ADR-002** — Studio architecture and provider routing (`docs/adr/002-studio-architecture.md`), covers SSRF protection, rate limiting (Upstash + in-memory), CSP headers, model validation, hydration strategy, logger redaction, server-side tool execution (web_fetch, code_execution)

---

## Related repositories

| Repo | Purpose |
|------|---------|
| [fworks-tech/agenthood](https://github.com/fworks-tech/agenthood) | The Society — 19 agent skill files, TypeScript runtime, CI workflows |
| [fworks-tech/flabs.tech](https://github.com/fworks-tech/flabs.tech) | Personal portfolio of the author |

---

*The Society is open to all who take the oath seriously. Membership is free. Standards are not.*
