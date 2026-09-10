# Agenthood

[![CI](https://github.com/fworks-tech/agenthood-site/actions/workflows/ci.yml/badge.svg)](https://github.com/fworks-tech/agenthood-site/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A full AI engineering team that earns every merge.

Live at **[agenthood.flabs.tech](https://agenthood.flabs.tech)** · [Studio Playground](https://agenthood.flabs.tech/studio/playground) · [Docs](https://agenthood.flabs.tech/docs)

---

## What is Agenthood?

Agenthood is a 20-member AI society — planners, builders, reviewers, auditors, and more — each a portable Markdown skill file, plus a TypeScript runtime that runs them autonomously across your whole software lifecycle.

Load them into **Claude Code, Copilot, Gemini CLI, Cursor, OpenCode**, or any runtime that supports skill files. Hand them a task, or let them run end to end.

No lock-in. No vendor-specific format. Setup in ~2 minutes. Every decision auditable.

---

## Features

- **20 specialized members** — architect, reviewer, tester, auditor, security, DevOps, and more
- **41 utility skills** — specialist capability files (docker, kubernetes, jira, postgres, and more) that activate on task match
- **Delegation chains** — chain agents together: tester → builder → reviewer → doorman
- **Autonomous runtime** — `npx agenthood run the-scribe "write a commit message"`
- **Multi-agent workspaces** — assemble a team, give one instruction, watch them collaborate; human checkpoints included
- **Decision intelligence** — tamper-evident audit trail with hash-chain provenance
- **Conventional commit enforcement** — zero tolerance for `fix stuff`
- **Agenthood Studio** — browser-based playground with multi-agent workspaces
- **7 LLM providers** — Anthropic, OpenAI, Groq, OpenRouter, Ollama, OpenCode
- **BYOK or zero-setup** — bring your own API key or use the default

---

## Quick Links

| Resource | URL |
|----------|-----|
| Live site | <https://agenthood.flabs.tech> |
| Studio Playground | <https://agenthood.flabs.tech/studio/playground> |
| Studio Workspaces | <https://agenthood.flabs.tech/studio/workspaces> |
| Documentation | <https://agenthood.flabs.tech/docs> |
| Academy | <https://agenthood.flabs.tech/academy> |
| ADRs | <https://agenthood.flabs.tech/adr> |
| Releases | <https://agenthood.flabs.tech/releases> |
| Upstream repo | <https://github.com/fworks-tech/agenthood> |

---

## Project Status

Agenthood is in **active development**. The skill file format is stable. The TypeScript runtime is the single supported runtime (see [ADR-008](docs/adr/ADR-008-typescript-runtime-over-python.md)).

See the [upstream releases](https://github.com/fworks-tech/agenthood/releases) for the latest changelog.

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| UI | Mantine UI + Tailwind CSS 4 |
| Deployment | Vercel |
| Test runner | Vitest + Playwright |
| LLM routing | agenthood runtime (`agenthood/dist/llm`) |

---

## Testing

```bash
npm test          # unit tests (Vitest)
npm run test:e2e  # end-to-end tests (Playwright)
```

| Suite | Count | What it covers |
|-------|-------|----------------|
| Unit | 413 | Error hierarchy, SSE parsing, secret redaction, provider routing, tool schemas |
| E2E | 106 | Config, conversations, playground, responsive layout, companion, error handling |

---

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

The `predev` script runs `sync-docs.mjs`, `sync-news.mjs`, and `sync-skills.mjs` to fetch latest content from the agenthood repo. Requires network access to `raw.githubusercontent.com`.

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Quick start:

1. Fork and clone this repo
2. `npm install`
3. `npm run dev` — runs sync scripts automatically
4. Create a branch: `type/issue-NUMBER-short-description`
5. Follow [Conventional Commits](https://www.conventionalcommits.org/)
6. Open a PR linked to an issue

> **Note:** Files under `content/` are auto-generated from the upstream `fworks-tech/agenthood` repo. Don't edit them directly — edit the upstream repo or the sync scripts.

---

## Architecture Decision Records

The full set lives in [`docs/adr/`](docs/adr/) — covering build-time docs sync, Studio architecture, provider routing, SSE telemetry, Turnstile gating, tool-execution replay, and more. Browse them rendered at [`/adr`](https://agenthood.flabs.tech/adr).

---

## Related repositories

| Repo | Purpose |
|------|---------|
| [fworks-tech/agenthood](https://github.com/fworks-tech/agenthood) | The Society — 20 member skill files, 41 utility skills, TypeScript runtime, CI workflows |
| [fworks-tech/flabs.tech](https://github.com/fworks-tech/flabs.tech) | Personal portfolio of the author |

---

## License

This project is licensed under the [MIT License](LICENSE).

---

*The Society is open to all who take the oath seriously. Membership is free. Standards are not.*
