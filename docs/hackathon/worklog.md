# Workspaces Frontier Hackathon — Work Log

> Running journal of decisions, builds, and insights. This feeds the final improvement
> changelog. Each entry is date-stamped with agent decisions and human insights separated.

---

## 2026-08-31 — Day 0: Scope & Spec

### What we did
- Created `frontier-hackathon` branch from `main` (up to date @ 31bd0ff)
- Extracted and read the hackathon brief (PDF → text via pdftotext)
- Verified the Studio codebase ground truth (frontend, API, adapter, types, tools, data)
- Created `HACKATHON-PLAN.md` as the project's memory
- Created `docs/hackathon/spec.md` — full feature spec

### Agent decisions
- **Feature naming:** "Workspaces" (not "Team Chat") — more intuitive, reflects the multi-agent assembly concept
- **Orchestrator role:** The Mediator (`the-mediator`) is always auto-included as the conductor — it classifies intent, delegates to selected members, and manages the handoff sequence. The user never picks the Mediator; it's the orchestration entry point.
- **Page layout:** 3-zone (sidebar with agent status cards + live group chat + input) — not the Playground's 3-pane (conversations + config + chat)
- **Default config:** server-side `opencode-go`, no client-side config panel — simplifies the flow, removes a decision the user shouldn't have to make
- **SSE vocabulary:** `workspace.*` prefix (not `team.*`) — matches the feature naming
- **Shared context:** distilled thread per member (not full raw) — deliberate "memory/context" choice for judges

### Human insights
- "Workspaces is a more intuitive name" — the user renamed from Team Chat
- "The mediator will be always included because he is the responsible for this role" — confirmed Mediator is not user-selectable
- "We will have a similar conversation chat on Workspaces, but it will be a live chat with participation of all selected members" — the chat is interactive, not one-shot
- "Differently from the Playground, we don't need to show the Agent Configuration section" — no config panel, defaults server-side
- "It will be like a sidebar with the agents selected being displayed one by one with statuses of their works/reasoning processes" — sidebar shows per-agent status
- "The chat will be a live place where the user can step in and interact with the agents anytime" — user can intervene mid-run
- "I would like to see same quality and well designed animations and layout from the Playground" — design parity is a requirement, not an afterthought
- "Use The Architecture to check and write the plan as well" — spec-first approach, following the Architect's process

### Evidence
- `HACKATHON-PLAN.md` — full plan with architecture, evaluation, roadmap
- `docs/hackathon/spec.md` — detailed spec with acceptance criteria
- Branch: `frontier-hackathon` (clean, only HACKATHON-PLAN.md untracked)

### Open questions
- Turn budget default: 10? 20?
- Context distillation strategy: full thread or distilled?
- Mediator plan format: JSON or natural language?
- Mobile sidebar: collapse into drawer?

### Resolved (same session)
- **Turn budget: 10** — conservative for 5-min demo; can tune up if runs converge faster
- **Context distillation: full thread, trimmed by max token budget** — trim oldest messages when thread exceeds budget. Simple, predictable.
- **Mediator plan format: JSON** — member → task mapping, deterministic for the scheduler
- **Mobile sidebar: yes** — collapse into drawer (same pattern as Playground's MobileDrawer)
- **maxDuration: client-driven loop** — each member turn = separate server call; client manages the orchestration loop
- **User intervention: pause + Mediator immediately** — current member is paused (AbortSignal), Mediator re-evaluates with new input immediately
- **Testing + docs gap patched (spec.md:251-275):** added regression gate (252 tests + lint + build), 4 unit suites + E2E cases + 80% coverage target, shared fixtures (`tests/helpers/agentFixtures.ts`), and Documentation section (README.md:21, REPRODUCTION.md, ADR, `data/workspaces/trajectories/`)

---

*Next entry: Day 1 — Baseline harness + first code.*
