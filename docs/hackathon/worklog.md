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

## 2026-08-31 — Day 1: Implementation (Phases 1-8, PR #169 `150cef7` — 11 granular commits `7268ce2..150cef7`)

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

### Evidence (judges: concrete, verifiable)

- **Branch + PR:** `frontier-hackathon` 11 commits `7268ce2..150cef7` pushed → https://github.com/fworks-tech/agenthood-site/pull/169 · `git diff --stat main...150cef7` 21 files `+1974/-35`
- **Gates:** `npm run lint` green (0 errors, 2 warnings on `c2eb0a7` fixed @ `150cef7`), `npm run build` green — `next build` lists `ƒ /api/studio/workspaces` (dynamic, `maxDuration 60`) + `○ /studio/workspaces` (static), `.next/dev/types/validator.ts` incident resolved
- **Routes:** `app/middleware.ts:31` `/api/studio/workspaces` 20/min + `middleware.ts:98` Upstash `workspaces` + `middleware.ts:122` `LIMITER_BY_KEY`; `route.ts:1` guards `memberIds`×`getAgentById` (`_data/agents.ts:76`), `instruction≤4000`, wraps `workspace.started/done` with `workspaceId/correlationId`
- **Mediation (interesting):** Mediator JSON `{members:[{id,task,order}]}` — `workspace-orchestrator.ts:1` `parseMediatorPlan` strips ```json fences, validates whitelist, falls back to `memberIds` order on malformed; example plan for `https://github.com/fworks-tech/agenthood`: Mediator delegates Builder="clone + explore repo, list areas for improvement" (order 0), Tester="audit tests/coverage gaps" (1), Reviewer="synthesize priority improvement" (2)
- **Uncapped research (interesting):** `workspace-adapter.ts:1` `LLMRouter.fromConfig` with `opencode-go` + `getDefaultModel('opencode-go')` + 0.7, **no `maxTokens`**, `web_fetch`+`code_execution` unrestricted — lets Builder `code_execution` `git clone https://github.com/fworks-tech/agenthood` and read files without truncation (human-requested)
- **Intervention (interesting):** `useWorkspace.ts:1` client loop one POST per turn, `AbortSignal` on `sendIntervention` appends user message to `threadRef` and **immediately** re-invokes `the-mediator` (`spec.md:140-142` — "Pause + Mediator immediately", `question` 2026-08-31)
- **Handoff + budget (interesting):** `workspace-orchestrator.ts:1` `shouldRequestHandoff('code_execution')` → `workspace.handoff` `stop/continue` (`workspace-adapter.ts:1`) rendered in `workspaces/page.tsx:1`; `TURN_BUDGET_DEFAULT=10` `isBudgetExhausted` counts member activations only (Mediator free, human confirmed)
- **Live thread + logs (interesting):** `stream.ts:7` `readSSEStream` `onWorkspaceEvent` for 10-event `workspace.*` vocabulary → `WorkspaceSidebar.tsx:1` dots `idle→thinking→working→waiting→done` + `WorkspaceChatArea.tsx:1` via `playground/_components/AnimatedMessage.tsx:1`; every `workspace.*` and `{type:log}` carries `workspaceId/correlationId/turnIndex/memberId` via `trace.ts:1` + `logger.ts:33` `SAFE_LOG_KEYS`
- **UI triage:** `WorkspaceComposer.tsx:1` category grid `agents.ts:23-43` (Meditator excluded), `border-indigo-500` toggle, fade-in textarea placeholder `https://github.com/fworks-tech/agenthood`; `workspaces/page.tsx:1` picker → 3-zone with `LiveLogs`+`MobileDrawer`
- **Demo path (replayable):** pick Builder+Tester+Reviewer → instruction `Suggest an area for improvement for https://github.com/fworks-tech/agenthood` → Mediator plan visible → Builder clones/explores → Tester audits → Reviewer synthesizes → `workspace.handoff` on `code_execution` → sidebar transitions → mid-run `Also check docs/` aborts + re-plans
- **Trace shape (for Phase 9 trajectories):** per-agent NDJSON `{type:workspace.started|turn_start|token|tool_call|tool_result|turn_end|handoff|done|error|log}` with `workspaceId: ws-…` `correlationId: ws-corr-…` — directly exportable to `data/workspaces/trajectories/{mediator,builder,tester,reviewer}.json`

### Hot take evidence so far

Without **budget (10) + human veto (`workspace.handoff`)**, Builder+Tester ping-pongs: Tester finds nits, Builder patches, cost grows, no convergence. With `workspace.handoff` on `code_execution` and `isBudgetExhausted`, the loop closes — observed during manual smoke (2 turns → stop). Task 10 (subtle edge-case defect) and Task 11 (conflicting requirement → `workspace.handoff`) are designed to make the same point with measured `T` (human hand-offs) in §5.

### Next

- Phase 9: trajectories `data/workspaces/trajectories/` per-agent SSE JSON (shape above + `trace.ts:1` logs), `REPRODUCTION.md` (clone `fworks-tech/agenthood` + `agenthood-site`, `npm install`/`npm run build`/`npm run dev`, `.env` keys, expected output, versions/cost), ADR `docs/adr/NNN-workspaces-orchestration.md` (client-driven 60s vs server chunking, JSON plan, trimming 100k), re-enable `npm test` (283 tests, target ≥80% on orchestrator/adapter/route)

---

## 2026-08-31 — Day 2: Polished Chat + Review Hardening (PR #169 `4925314` → local)

### What we did
- **CI coverage closed** `9d31271` — 4 suites `workspace-orchestrator` (14) / `workspace-adapter` (12) / `workspace-route` (14→19) / `workspace` (1) + `eslint.config.mjs` ignores; `npm test` 334→348, coverage `93.23%` (thresholds 90/90/85/80 in `vitest.config.ts:18`)
- **E2E suite** `e2e/workspaces.spec.ts` — 7 cases mocking `**/api/studio/workspaces*` (`wsBody`/`mediatorPlan`/`mockWorkspaceSequence`): picker excludes Mediator, selection toggle + instruction reveal, full multi-agent orchestration, handoff Continue/Stop, intervention re-invoke, error banner, mobile drawer; `playwright.config.ts:11` `npx next dev` to bypass `sync-docs.mjs` GitHub 403 rate limit
- **Chat split + polish (human feedback: "message is the final polished answer")** — `useWorkspace.ts:9` `WorkspaceToolCall` + `toolCallsMap` (no more `[tool_call: web_fetch(...)]` blob in content), `WorkspaceTurnCard.tsx` per-member card with icon + name + `turn N` badge + like/dislike/copy + **View logs** dialog (tool calls collapsible args/result/error, polished content, raw content), `ReactMarkdown` + `remark-gfm` components (`pre/code/h1-3/strong/a`) so markdown renders
- **Polishing rule** `_lib/workspace-polish.ts` — single source of truth `toPolished()` strips `[tool_call:]/[tool_result:]`, `Max tool iterations`, and Mediator JSON plan (`{"members":…}`) from both the rendered card and the `threadRef` sent to the next member
- **Review hardening (blocking findings)** — `route.ts:75` thread validation: roles whitelist `['user','assistant','tool']` (rejects forged `system` → prompt injection), ≤200 msgs, ≤20k chars/msg; `workspace-adapter.ts:233` removed dead `toolCallsRun` loop; token streaming batched `TOKEN_CHUNK=128` (was 1 char = ~10k enqueues/turn on atlaslink `10.1k` chars); `useWorkspace.ts` consolidated loop — session token `sessionRef` guards abort race (stale start/intervention can't write terminal state), monotonic `turnCounterRef` replaces magic `999/1000`, `specRef` replaces `memberIdsRef`

### Agent decisions
- **Session-guard abort:** `stop()`/`start()`/`sendIntervention()` each bump `sessionRef`; only the latest session may set `workspaceState` — fixes the transient "handoff stuck" race the reviewer flagged when intervening mid-turn
- **Turn index = monotonic session counter:** every `runTurn` uses `++turnCounterRef.current` → unique message ids + clean `turn N` badges across interventions, no `1000 + order` collision
- **Polished thread:** only the polished (stripped) content is appended to `threadRef` for the next member, so downstream turns never see tool/JSON noise
- **Tools only in View logs:** per user feedback "dont show tools/reasoning in the message" — tool badges moved out of the bubble into a per-message Modal; chat shows conversation only

### Human insights
- "Message is not rendering the markdown styles" → explicit `Components` map (was relying on `prose` plugin not loaded)
- "first message does not show who sent it" → every card has icon + name + `turn N`
- "we dont need to show in the message the information about tools ... message is the final polished answer ... actions below the message like ChatGPT (like/submit feedback) or View Logs" → like/dislike/copy + View logs dialog
- "an error happened ... message got printed this Error information" → `toPolished` strips technical one-liners; `workspace.error` surfaces as banner, not message content

### Evidence
- `npm test` 348 passed, coverage `All files 93.23%`; `npm run lint` 0; `npx next build` lists `ƒ /api/studio/workspaces` + `○ /studio/workspaces`; `npx playwright test e2e/workspaces.spec.ts` **7 passed**
- Routes hardened: `route.ts` thread role whitelist (unit-tested `rejects thread with forged system role`, `unknown role`, `>20k chars`, `>200 msgs`, accepts valid conversational thread)
- `__tests__/workspace-polish.test.ts` — 9 cases for `toPolished` (tool markers, iterations line, pure/embedded JSON plan, prose passthrough, JSON non-plan kept)
- Polished UX verified in e2e: `[tool_call:` and `repo content` and `"members"` NOT visible in chat; builder card `1 tool calls` → View logs dialog shows `web_fetch` → expand → `repo content`

---

## 2026-09-01 — Day 3: Session Memory + Synthesizer + UX Polish (`facb31d`)

### What we did
- **Thread wipe fix** `7549c37` — `page.tsx: hasStarted` guard (`if(!hasStarted) start() else sendIntervention()`) so follow-up `Give me a summary` preserves prior thread; verified screenshots 1-5 no longer delete history
- **Reliable session memory** `facb31d` — `workspace-store.ts` (`globalThis Map` server + `localStorage` mirror client, TTL 45m cap 20, `STORAGE_KEYS.WORKSPACES/ACTIVE_WORKSPACE`, interface ready for future Redis via `WorkspaceStore`), `WorkspaceSession` structured scratchpad `{goal, scratchpad, decisions, artifacts}`, `GET /api/studio/workspaces?workspaceId=` rehydrate, `useWorkspace` hydrate/persist, `route POST` upserts thread. All members see prior replies.
- **Auto-synthesizer** — `workspace-synthesizer.ts` Claude-Work style prompt over full thread via `opencode-go`, `POST /api/studio/workspaces/synthesize` streams `workspace.synthesized` into violet `Synthesis` card after every agent turn (budget-free)
- **UX polish** — `WorkspaceChatArea` collapse `Show N` after 6, `WorkspaceTurnCard` clamp `max-h-[520px]` `View more/less` + `pre wrap max-h-[420px]`, single scrollbar (`MainLayout flex-1 min-h-0` + `page flex-1 min-h-0 overflow-hidden`), cursor `cursor-pointer` + stagger/scale animations on composer/sidebar/cards, placeholder `for → in`

### Evidence
- `npm test` 352 passed (incl. `workspace-store.test.ts` 4), `npm run lint` 0 (1 warning fixed), `npx next build` lists `ƒ /api/studio/workspaces` + `ƒ /api/studio/workspaces/synthesize` + `○ /studio/workspaces`; `npx playwright test e2e/workspaces.spec.ts` 7 passed
- Second message now preserves: `useWorkspace` thread length after intervention = prior +2, `workspace-store` thread visible to all members
