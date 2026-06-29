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
| `/studio` | Agenthood Studio — chat with Society members, dashboard |
| `/studio/playground` | Interactive chat playground with agent config panel |
| `/studio/dashboard` | Runtime dashboard: KPI cards, agent status, activity feed |
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

The Studio is a browser-based proof-of-work for the agenthood runtime. It allows users to chat with any of the 16 Society members through a configurable provider backend.

### API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/studio/chat` | SSE-streamed chat with an agent |
| GET | `/api/studio/agents` | List all Society members |
| GET | `/api/studio/status` | Runtime health (agents online, errors, activity) |

### Authentication

The chat endpoint supports optional token-based auth. Set `STUDIO_API_TOKEN` in Vercel env vars. If set, all requests must include `Authorization: Bearer <token>`. If unset, the endpoint is public (for development).

### Provider Routing

All LLM requests are routed server-side through the agenthood `LLMRouter`. The provider chain is:

1. User-selected provider (from the client config)
2. Groq (fallback if primary fails)
3. Ollama (local fallback)

Ollama requests are proxied server-side — the browser never connects directly to localhost. This ensures consistent rate limiting, input validation, and logging across all providers.

**Supported providers:** Anthropic, OpenAI, Groq, Ollama (local), OpenCode (local/cloud)

### Rate Limiting

In-memory sliding-window rate limiter at the Edge middleware layer:

| Path | Limit | Window |
|------|-------|--------|
| `/api/studio/chat` | 20 req/min | 60s |
| `/api/studio/agents` | 60 req/min | 60s |
| `/api/studio/status` | 30 req/min | 60s |

Store is capped at 10,000 entries with LRU eviction.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | For Anthropic | Claude API key |
| `OPENAI_API_KEY` | For OpenAI | GPT API key |
| `GROQ_API_KEY` | For Groq | Groq API key |
| `STUDIO_API_TOKEN` | Optional | Bearer token for API auth |
| `GROQ_DEFAULT_MODEL` | Optional | Default Groq model (e.g. `llama-3.3-70b-versatile`) |

### Studio Code Layout

```
app/studio/
├── page.tsx                        Hub page
├── playground/page.tsx             Chat playground
├── dashboard/page.tsx              Runtime dashboard
├── layout.tsx                      Studio layout
├── error.tsx / loading.tsx         Error/loading boundaries
├── _components/                    React components
│   ├── AgentConfigPanel.tsx        Agent selection + config controls
│   ├── AgentSidebar.tsx            Agent list sidebar
│   ├── ChatArea.tsx                Chat container
│   ├── ChatComposer.tsx            Message input
│   ├── MessageList.tsx / MessageBubble.tsx   Chat messages
│   ├── LiveLogs.tsx                Event log panel
│   └── OllamaConnectivityCheck.tsx Local Ollama reachability
├── _hooks/
│   ├── useStudioChat.ts            Chat state + streaming + persistence
│   └── useAgentDirectory.ts        Agent list fetch
├── _lib/
│   ├── agenthood-adapter.ts        LLMRouter wrapper → ReadableStream
│   ├── env.ts                      Env var helpers
│   ├── errors.ts                   StudioError hierarchy
│   ├── logger.ts                   Structured JSON logging with redaction
│   ├── stream.ts                   NDJSON/SSE stream reader
│   └── studio-api.ts               Client-side fetch wrappers
├── _data/
│   ├── agents.ts                   Static agent registry (16 members)
│   └── agents.generated.ts         Auto-generated skill prompts
└── _types/
    └── studio.ts                   TypeScript types for providers, config
```

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

Tests are in `__tests__/` and cover:

| File | Tests | What it covers |
|------|-------|----------------|
| `errors.test.ts` | 8 | Error hierarchy, status codes, instanceof checks |
| `stream.test.ts` | 7 | SSE parsing, token events, error events, abort, malformed data, double-onDone guard |
| `logger.test.ts` | 4 | Secret redaction, sanitization accuracy |

---

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The `predev` script runs `sync-docs.mjs` and `sync-skills.mjs` to fetch latest content from the agenthood repo. Requires network access to `raw.githubusercontent.com`.

---

## Architecture Decision Records

- **ADR-001** — Build-time documentation sync (`docs/adr/001-build-time-docs-sync.md`)
- **ADR-002** — Studio architecture and provider routing (`docs/adr/002-studio-architecture.md`)

---

## Related repositories

| Repo | Purpose |
|------|---------|
| [fworks-tech/agenthood](https://github.com/fworks-tech/agenthood) | The Society — 16 agent skill files, TypeScript runtime, CI workflows |
| [fworks-tech/flabs.tech](https://github.com/fworks-tech/flabs.tech) | Personal portfolio of the author |

---

*The Society is open to all who take the oath seriously. Membership is free. Standards are not.*
