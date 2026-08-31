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

---

## 2026-08-31 — Day 1: Implementation (Phases 1-8)

### What we did
- **Phase 1** `refactor(studio): extract shared SSE runner and trace helpers` — extended `app/(main)/studio/_lib/stream.ts` with `onWorkspaceEvent` for `workspace.*` vocab, created `app/(main)/studio/_lib/trace.ts` (`emitLogEvent`, `buildTraceEnvelope`, `createWorkspaceTraceMeta`), extended `app/(main)/studio/_lib/logger.ts` SAFE_LOG_KEYS with `workspaceId/turnIndex/memberId`, refactored `agenthood-adapter.ts` to reuse helpers
- **Phase 2** `feat(workspaces): define workspace types and SSE vocabulary` — expanded `app/(main)/studio/_types/workspace.ts` (`TURN_BUDGET_DEFAULT=10`, `WorkspaceSpec/Status/Turn/MediatorPlan/WorkspaceEvent`, 10-event `workspace.*` union), doc-sync: `spec.md` MaxTokens 4096 → uncapped (provider max) per human request for full repo research
- **Phase 3** `feat(workspaces): implement turn scheduler with budget and thread trimming` — `workspace-orchestrator.ts` pure helpers: `parseMediatorPlan` (strip fences, validate `getAgentById`), `fallbackPlan`, `trimThread` (oldest-first 100k chars), `buildMemberMessages`, budget helpers (`isBudgetExhausted`, `getNextMember`, `advanceState`, `shouldRequestHandoff` for `code_execution`)
- **Phase 4** `feat(workspaces): implement workspace adapter with uncapped server defaults` — `workspace-adapter.ts` `createWorkspaceTurnStream` calls `LLMRouter.fromConfig` with `opencode-go` + `getDefaultModel('opencode-go')` + 0.7 + `web_fetch`/`code_execution` unrestricted, no `maxTokens` cap, emits `workspace.turn_start/token/tool_call/tool_result/turn_end/status/handoff/error` + mirrored `{type:log}` with `workspaceId/correlationId`
- **Phase 5** `feat(workspaces): add workspaces API route and rate limiting` — `app/api/studio/workspaces/route.ts` validates `memberIds` via `getAgentById`, `instruction` ≤4000, wraps turn stream with `workspace.started`/`workspace.done`, 20 req/min `RATE_LIMITS` + Upstash `workspaces` bucket + `LIMITER_BY_KEY` in `app/middleware.ts:31,98,122`
- **Phase 6** `feat(workspaces): implement client workspace state machine with intervention` — `app/(main)/studio/_hooks/useWorkspace.ts` client-driven loop (one POST per member turn, `maxDuration 60` per turn, `readSSEStream` with `onWorkspaceEvent`), Mediator first parses plan → ordered member turns, budget `10` (member activations only, Mediator free), `AbortSignal` pause + immediate Mediator re-plan
- **Phase 7** `feat(workspaces): build workspace composer and thread components` — `WorkspaceComposer` (category grid from `agents.ts`, indigo `border-indigo-500` toggle, fade-in textarea placeholder `https://github.com/fworks-tech/agenthood`), `WorkspaceSidebar` (Mediator-first status dots `idle/thinking/working/waiting/done`), `WorkspaceChatArea` (reuses `playground/_components/AnimatedMessage.tsx`), `WorkspaceTurnCard`
- **Phase 8** `feat(workspaces): integrate workspaces page with 3-zone layout` — replaced 449-line Playground copy in `app/(main)/studio/workspaces/page.tsx` with composer → 3-zone (`WorkspaceSidebar` + `WorkspaceChatArea` + input + `LiveLogs` + `MobileDrawer`), removed 6 duplicate playground copies (`AnimatedMessage` etc) now imports shared, handoff stop/continue UI, `lint` + `build` green

### Agent decisions
- **Uncapped tokens:** per human request, server defaults no longer pass `maxTokens` — Builder/Tester/Reviewer can `web_fetch` + `code_execution` clone `https://github.com/fworks-tech/agenthood` without truncation; input trimming stays (oldest-first) but output is provider max
- **Logs + workspace object on every request:** every `workspace.*` event and `log` carries `workspaceId/correlationId/turnIndex/memberId` via `trace.ts` helpers, satisfies "logs and workspace object will be used on all the requests and reasoning processes"
- **Budget counts member activations only:** Mediator turn is free, budget 10 = 10 member turns (human confirmed), keeps demo predictable

### Human insights
- "one commit" for Phase 7 — kept `WorkspaceComposer/ChatArea/Sidebar/TurnCard` together
- "dont limit the tokens ... be able to research the web, read repos, understand and write code. I would like to see a workspace with The Builder + The Tester + The Reviewer being able to access a given repo from the user like https://github.com/fworks-tech/agenthood and suggest an area for improvement" — drove uncapped + unrestricted tools
- "be sure the logs and workspace object will be used on all the requests and reasoning processes for the Workspace session" — drove trace/logger extension
- "remember to keep synced the docs inside docs/hackathon" — tri-sync maintained (spec + plan + worklog updated together)
- "lets skip tests while we still not finish the workspace implementation" — kept `lint`+`build` gates, deferred `npm test` (283 tests) until feature complete

### Evidence
- Branch `frontier-hackathon` 8 commits beyond `e0414c7` scaffold: `718128c` → `c2eb0a7`, `lint` green, `build` green, `/studio/workspaces` renders picker → 3-zone, API guards + rate limit verified
- Demo path ready: select Builder+Tester+Reviewer → instruction `Suggest an area for improvement for https://github.com/fworks-tech/agenthood` → Mediator JSON plan → Builder clones/explores → Tester audits → Reviewer synthesizes → `workspace.handoff` on `code_execution` → sidebar transitions → intervention aborts + re-plans

### Next
- Phase 9: trajectories (`data/workspaces/trajectories/` per-agent SSE JSON), `REPRODUCTION.md`, ADR `NNN-workspaces-orchestration.md`, coverage ≥80% suites when re-enabling tests
