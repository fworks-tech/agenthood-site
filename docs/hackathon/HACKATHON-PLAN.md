# Agentic Workflows Frontier Hackathon — Multi-Agent Workspaces for the Agenthood Studio

> **Status:** Phases 1-10 landed on `frontier-hackathon` @ `facb31d` (PR #169 — 15 commits). Reliable session memory + auto-synthesizer landed. `lint` + `build` + `352 tests` green. Tri-synced with `spec.md` and `worklog.md`.

---

## 1. The Idea (one line)

**"Workspaces" for the Agenthood Studio** — pick several Society members at once (e.g. The
Builder + The Tester + The Reviewer) with a tap per member, write a single instruction, and watch
them plan, act, retry, and hand off to each other inside one shared, live thread.

Today the Playground (`/studio/playground`) is strictly one-to-one: you pick a single member and
chat with it. To get a Builder -> Tester -> Reviewer cycle a human must copy-paste output between
members and re-contextualize every turn. This project builds the missing orchestration layer on
top of the existing Studio so a user can run a *workspace* of specialized members on one task and
see the whole team work in real time.

## 2. Why this fits the hackathon

The hackathon brief (agentic-workflows PDF) scores 100 points across six criteria. Every one is
directly addressable by this project:

| Criterion | Points | How this project hits it |
|---|---|---|
| Problem & User Value | 15 | Clearly defined user (Studio users), a concrete bottleneck (manual relay between members), real value (see the team negotiate a task end to end). |
| Agent Solution & Engineering | 30 | Purposeful orchestration across several agents: turn scheduling, shared thread, role hand-offs, retry/stop budget, live SSE, human checkpoints. |
| End-to-End Quality | 20 | A working team conversation with a finished artifact (tests passing + review) instead of a generic AI draft. |
| Measured Improvement | 15 | 1:1 manual relay (baseline) vs. Workspaces (final) on the same 10+ cases; one primary metric; per-iteration changelog with evidence. |
| Reproducibility | 15 | Two public repos, exact commands, clean-environment guide, expected output, versions + cost. |
| Hot Take / Insights | 5 | Observed failure mode (agent loops / redundant work) turned into a lesson about budgets and human veto. |

### The four questions (the brief's frame)

1. Who has this problem?
2. What bottleneck makes it worth solving?
3. Does the agent solve it well?
4. Can another person reproduce the result?

Every section of this plan answers one of these: §3 answers 1-2, §4-§5 answer 3, §6 answer 4.

### Ground rules (verbatim from the brief) — how this project complies

| Rule | Brief text | Our compliance |
|---|---|---|
| 01 | Build with tools and components you already know | We reuse the Agenthood runtime + Studio (member skills, LLMRouter, tool loop). |
| 02 | Make it clear what existed before the competition and what you added | Explicit boundary line below + README declares it. |
| 03 | Use every tool/component according to license and service terms | Public repos, no new third-party runtime deps. |
| 04 | Keep consequential actions controlled through a sandbox or simulation. Add human approval before the action happens | `code_execution` already runs in a node:vm sandbox; orchestrator emits `workspace.handoff` (stop/continue) before consequential turns. |
| 05 | Make a qualified human reviewer part of any solution that could significantly affect someone | Eval rubric includes a human reviewer grading the final artifact; Reviewer member as a gate. |
| 06 | Choose a legal and ethical use case | Building software features with tests — benign. |
| 07 | Use information you are allowed to share | Eval cases are synthetic snippets in this public repo. |
| 08 | Keep credentials and private information outside the submission | Keys via `.env`; trace/log events are safe-key filtered; never commit keys. |
| 09 | Connect every claim about results to the evidence you submit | Every changelog row points to a run logged in `data/`. |
| 10 | Give judges enough access to run the project and reproduce the main result | REPRODUCTION.md + `data/` artifacts + trajectories. |

### Ground Rule 02 — what existed before vs. what we add

The rules require us to be explicit about the platform boundary. This is a strength of the idea:

- **Exists before (public, upstream):** the Agenthood runtime + the Agenthood Studio site.
  The runtime provides members, skills, providers, the `agenthood` SDK used by the Studio.
  The Studio provides the single-agent chat UI (`/studio/playground`), the SSE stream, the live
  logs panel, and the tool loop (web_fetch / code_execution).
- **We add (this repo, this submission):** the multi-agent orchestration layer (turn scheduler,
  shared thread, routing/review loop, stop budget, human checkpoints), the Workspaces UI in the
  Playground, and the evaluation harness that proves the improvement.

We build **on** Agenthood so we can spend our engineering budget on the orchestration problem,
not on re-implementing the runtime. The README + changelog will declare this boundary line.

## 3. The User and the Bottleneck (Problem & User Value)

**Who has this problem?**
- Studio Playground users who want a *team* result (implement + verify + review) and currently
  have to drive each member one at a time.
- Anyone whose real task needs more than one specialized agent: a Builder who cannot verify their
  own code and a Tester who catches it; a Builder + Reviewer pairing for code quality.
- Agenthood users who want to demonstrate or observe multi-agent orchestration (the point of the
  platform) but have no in-product way to see agents coordinate.

**What bottleneck makes it worth solving?**
- Manual relay: copy Builder output -> paste into Tester chat -> copy Tester failures -> paste back
  into Builder -> repeat until convergence. Context gets lost, re-explained, or bloated at every hop.
- No single source of truth: each conversation lives in its own chat; the chain of reasoning across
  members is invisible and un-replayable.
- Opaque execution: you cannot watch the team plan and react; you only ever see one member "thinking"
  at a time.
- Not reproducible: a human relay cannot be scripted, measured, or audited the way a team workflow can.

**Value if solved:** the first place a user can start a conversation with an agent *workspace*,
see members talk to each other, converge on a finished artifact, and trace exactly who did what.
It turns the Studio from a single-agent REPL into a small "engineering org" you can watch.

## 4. Architecture — grounded in the current Studio code

> **Full spec:** [`spec.md`](spec.md) — the detailed design
> document covering page layout, orchestrator state machine, SSE events, API contract, file
> tree, and acceptance criteria.

### How the Playground works today (single agent) — ground truth (verified 2026-08-31, main @ 31bd0ff)

- **Frontend — shared studio layer:** `app/(main)/studio/_components/` holds the reusable UI
  (`AgentConfigPanel.tsx`, `ChatComposer.tsx`, `MessageList.tsx`, `MessageBubble.tsx`,
  `LiveLogs.tsx`, plus ConversationList / AgentListItem / DragHandle / HelpTip / MobileDrawer /
  MobileBottomSheet / OllamaConnectivityCheck); `_hooks/` holds the client state machines
  (`useStudioChat.ts`, `useAgentDirectory.ts`, `useCaptcha.ts`, `useLogs.ts`, `useToolReplay.ts`,
  `useConversationExport.ts`).
- **Frontend — route-scoped:** `app/(main)/studio/playground/page.tsx` (892 lines: composes the
  3-pane layout, Turnstile wiring, analytics, sessionStorage log persistence) plus
  `playground/_components/WelcomeTerminal.tsx` and `AnimatedMessage.tsx`. A new `/studio/workspaces`
  route follows the same split: `workspaces/page.tsx` + `workspaces/_components/*` +
  `workspaces/_hooks/*`, importing shared bits from the `_components/`/`_hooks/`/`_lib/`/`_types/`
  layer above.
- **SSE consumption:** NDJSON over POST + ReadableStream (EventSource can't POST), parsed by
  `readSSEStream` with `StreamCallbacks` (`_lib/stream.ts:7-14`). Wire union
  `token | tool_call | tool_result | done | error | log` (stream.ts:60-80). Note:
  `useStudioChat.ts` duplicated the consumption block in `sendChat` (305-362) and
  `retrySendMessage` (462-519) — the workspace hook must NOT copy this; extract a shared runner.
- **API:** `app/api/studio/chat/route.ts` — POST handler validating one `agentId`, `messages[]`,
  and `config` (provider / model / temperature / maxTokens / enabledTools). Guards: correlation-id
  header, message caps (50 msgs / 4000 chars / 100k total), config validation, Turnstile
  (unless `TURNSTILE_ENABLED=false`), agent whitelist via `getAgentById`. Emits SSE via
  `new Response(stream, {...})` with `runtime = "nodejs"`, `dynamic = "force-dynamic"`,
  `maxDuration = 60`. Sibling routes already exist: `agents`, `tools`, `feedback`, `status`.
- **Adapter:** `app/(main)/studio/_lib/agenthood-adapter.ts` — `LightweightAdapter.chat()` builds
  the system prompt from `agentSkills[agentId]` (`_data/agents.generated.ts`), constructs an
  `LLMConfig` (`LLMRouter.fromConfig`) with a provider chain (primary + `FALLBACK_ORDER =
  [groq, openai, ollama]`, failureThreshold 3, cooldownMs 30000), runs either a plain stream or a
  tool loop (`runToolLoop` with `MAX_TOOL_ITERATIONS = 5`), and emits SSE events:
  - `{ type: "token", data }` — streamed output
  - `{ type: "tool_call", id, name, args }` / `{ type: "tool_result", id, name, result, error }`
  - `{ type: "done" }` and `{ type: "error", data }`
  - `{ type: "log", level, event, ...pickSafeLogMeta(meta) }` — safe-key filtered structured logs
    for the LiveLogs panel; `chat.routing` / `chat.complete` / `chat.aborted` / `chat.error` / `trace`.
- **Types:** `_types/studio.ts` — `Provider` (7), `ChatConfig`, `PROVIDER_MODELS`, `CODE_AGENTS`
  (the-architect, the-reviewer, the-tester, the-debugger, the-warden), `getProviderMeta`,
  `getDefaultModel`. No exported SSE type union or `StudioRole` — role is free-text on
  `AgentEntry.role` (SITE_CONFIG in `_data/agents.ts`) plus a `stage[]` array on
  `registry.generated.ts` entries (spec|commit|implement|review|test|audit|release|docs|deploy|deliver)
  — the stage list is directly usable for turn scheduling.
- **Tools:** `_lib/tools.ts` — `web_fetch` (host allowlist + 15k char cap), `code_execution`
  (node:vm sandbox, 5s timeout), `executeTool`, `getToolSchemas`. Tool results are trimmed to
  strings; failures returned as strings, never thrown.
- **Data:** `_data/` holds generated `agents.generated.ts` (20 members' SKILL.md bodies),
  `agentPrompts.generated.ts`, `registry.generated.ts`, and hand-maintained `agents.ts`
  (`AgentEntry`, `SITE_CONFIG`, `SITE_ORDER`, `getAgentById`). Generated files are overwritten by
  `scripts/sync-skills.mjs` — never edit them. Site copy says "19" in places but the count is 20
  (the-mediator added).
- **Rate limiting:** `app/middleware.ts` `RATE_LIMITS` (chat = 20 req/min) matches
  `/api/studio/:path*` — a new `/api/studio/workspaces` route needs its own entry here.

### What we add — the Workspaces layer

Landed files (11 commits, `main..frontier-hackathon` 21 files, `150cef7`):

```
app/(main)/studio/workspaces/                # Workspaces page (sibling of playground)
  page.tsx                                   # 3-zone: WorkspaceSidebar + WorkspaceChatArea + input + LiveLogs + MobileDrawer
  _components/WorkspaceComposer.tsx          # member multi-select + instruction input (first interaction)
  _components/WorkspaceChatArea.tsx          # threaded, per-member bubbles (reuses playground/_components/AnimatedMessage.tsx:1)
  _components/WorkspaceSidebar.tsx           # Mediator-first status cards (idle/thinking/working/waiting/done)
  _components/WorkspaceTurnCard.tsx          # one member's turn: plan -> act -> result
  _hooks/useWorkspace.ts                     # client-side orchestration state machine (client-driven loop, AbortSignal)
app/api/studio/workspaces/route.ts           # POST: start/continue a workspace run (SSE, maxDuration 60, wraps workspace.started/done)
app/(main)/studio/_lib/workspace-adapter.ts  # createWorkspaceTurnStream (uncapped, web_fetch+code_execution, workspace.* + log)
app/(main)/studio/_lib/workspace-orchestrator.ts  # parseMediatorPlan/fallbackPlan/trimThread/budget helpers (TURN_BUDGET_DEFAULT=10)
app/(main)/studio/_lib/stream.ts             # readSSEStream extended with onWorkspaceEvent (workspace.* vocabulary)
app/(main)/studio/_lib/trace.ts              # emitLogEvent/buildTraceEnvelope/createWorkspaceTraceMeta (workspaceId on every log)
app/(main)/studio/_lib/logger.ts             # SAFE_LOG_KEYS extended with workspaceId/turnIndex/memberId
app/(main)/studio/_types/workspace.ts        # WorkspaceSpec, WorkspaceTurn, WorkspaceEvent (10 events), MediatorPlan
app/middleware.ts                            # RATE_LIMITS /api/studio/workspaces 20/min + Upstash workspaces bucket
```

#### Page flow (the first interaction)

`/studio/workspaces` mirrors the Playground's layout but **starts with member selection**: one
button per Agenthood member, multi-select. Right below the picker sits the instruction input box.
Submitting starts the workspace: The Mediator ingests the instruction, understands the problem,
and delegates tasks to the selected members, who then work together on the shared live thread.

#### Orchestrator design (the purposeful engineering)

- **`WorkspaceSpec`** — the user-provided plan: instruction prompt, selected member roster with a
  **role** each, a **turn budget** (max member activations), and optional member ordering/policy
  (e.g. builder-then-tester, or reviewer-after-tester on failure).
- **Mediator-first intake** — the workspace opens with the Mediator (`the-mediator`): it receives
  the user's instruction, understands the problem, and produces the delegation plan — which
  selected member does what, in what order. Its registry role is already
  "intent classification, first-line handoff, orchestration entry", so this is a real member, not
  a synthetic router.
- **Turn scheduler** (`workspace-orchestrator.ts`) — a small state machine over one shared thread:
  1. Dispatch the instruction to the Mediator; append its delegation plan to the shared thread.
  2. Execute the plan member by member (e.g. Builder first): dispatch with the member's own
     `agentSkills` prompt + shared thread context.
  3. Append the member's turn (its output, tool calls, tool results) to the shared thread.
  4. Dispatch the next member (Tester) with the same thread; the Tester sees the Builder's work.
  5. If the Tester reports failures and the turn budget allows, loop back to the Builder with the
     failure feedback (this is the retry loop, bounded by the budget).
  6. If a Reviewer is in the roster, run a final review pass; a failing review can return to the
     Builder once more if budget remains.
  7. Stop when: all roles pass, the turn budget is exhausted, the human stops the run (AbortSignal),
     or a member requests a human checkpoint.
- **Shared context — full thread, trimmed (not LLM summary)** — each member receives its own `agentSkills` system prompt + the shared thread trimmed oldest-first to 100k chars (`workspace-orchestrator.ts:1` `trimThread`). Input trimming stays; output is uncapped (provider max) per `spec.md:77` — deliberate "memory/context" choice that lets Builder/Tester/Reviewer fetch `https://github.com/fworks-tech/agenthood` without truncation.
- **Human checkpoints** — before `code_execution`, the orchestrator emits `workspace.handoff` (`workspace-orchestrator.ts:1` `shouldRequestHandoff`) with stop/continue; `workspace-adapter.ts:1` mirrors `{type:log}` with `workspaceId/correlationId`. Satisfies ground rule 04.
- **Logs + workspace object on every request** — every `workspace.*` and `{type:log}` carries `workspaceId/correlationId/turnIndex/memberId` via `trace.ts:1` + `logger.ts:33` (`SAFE_LOG_KEYS`). Requested by human: "be sure the logs and workspace object will be used on all the requests and reasoning processes".
- **Events** — extend the SSE vocabulary so the frontend can render a workspace turn visibly:
  `workspace.started`, `workspace.turn_start` (member id, role), `workspace.token`,
  `workspace.tool_call` / `workspace.tool_result`, `workspace.turn_end` (result + decision:
  pass / handoff / failed), `workspace.done`, `workspace.error`, `workspace.handoff` (awaiting
  human). Reuse the existing `Logger` / correlation-id conventions and mirror `{ type: "log" }`
  events for the LiveLogs panel.
- **Reuse over re-invention** — the orchestrator calls the same `LLMRouter` + tool loop the
  single-agent adapter uses; it adds the *routing* layer on top. Trajectories for the submission
  come from the emitted `workspace.*` events.

## 5. Evaluation & Measured Improvement (15 pts)

### Primary metric (define once, use everywhere)

**Task completion time and human hand-offs to reach a passing result.**

- `T` = number of *human* hand-offs the user must perform to finish the task (baseline: many,
  because every member switch is manual).
- `C` = wall-clock task time for a fixed agent budget of turns.
- Primary outcome on the submission table: **human hand-offs per task** (0 for Workspaces when it
  converges, N > 0 for the manual relay baseline).

Secondary, supporting metrics: pass rate on the eval cases, tokens/cost per task, and "quality of
the final artifact" (graded against a fixed rubric: does it satisfy the task, do the tests pass,
is the review substantive).

### Eval cases — 10+, same cases for baseline and final

Pick tasks that genuinely require two or more roles so the comparison is fair:

| # | Task | Roles | Notes |
|---|---|---|---|
| 1 | "Add a feature and verify with tests" | Builder + Tester | main happy path |
| 2 | "Refactor X; ensure the suite still passes" | Builder + Tester | |
| 3 | "Fix this bug; prove it with a regression test" | Debugger + Tester | |
| 4 | "Implement + review for code quality" | Builder + Reviewer | |
| 5 | "Write code, test it, review it, then fix review findings" | Builder + Tester + Reviewer | full loop |
| 6-9 | Three more variants across the same roles | ... | keep near-realistic |
| 10 | **Challenging case:** a task engineered to produce a defect the Tester should catch and the
      Builder should then fix (e.g. a subtly wrong edge case). | Builder + Tester | the "hard" case |
| 11 | Convergence test: task with a genuinely conflicting requirement where the team should
      request a human decision (exercises the handoff = hot take material). | Builder + Reviewer | optional |

Each case = a fixed task prompt string + a fixed repo snippet to work on. No LLM stochastic
"extra" — only the task text changes.

### Baselines

- **Baseline A (the honest comparison, corresponds to today's Studio):** a human operator relays
  between members manually using the current 1:1 Playground. Measures `T` (hand-offs) and `C`
  (operator time). Run on the same 10+ cases.
- **Baseline B (reference floor):** a single general-purpose agent (default Studio member) given
  the task with no team — shows whether the extra members add real value or just tokens.
- **Final:** Workspaces with Mediator + Builder+Tester(+Reviewer) and a fixed turn budget.

Runner runs all three on the same inputs; results table with `T`, `C`, cost, and pass rate per case.
The resource difference between baselines and final is stated explicitly per run (turn budget, tokens, and
which members each baseline could use) so the comparison stays fair and transparent.

### Improvement changelog (structure the repository will use)

> **Working version:** [`worklog.md`](worklog.md) — the daily
> journal of decisions, builds, and insights. This table is the distilled final version.

| Stage | What we tried and why | Evidence | Decision |
|---|---|---|---|
| Baseline | Manual 1:1 relay in today's Playground | result on 10+ cases | starting point |
| Iteration 1 | Workspace adapter with a fixed linear order (Mediator -> Builder -> Tester) | result | keep or revise |
| Iteration 2 | Added the retry/stop budget after observing loops | result | keep (bounded retries) |
| Iteration 3 | Added Reviewer as a final gate after a passed-tests-but-bad-code case | result | keep or revise |
| Iteration 4 | Added context distillation after observing thread bloat / token cost | result | keep |
| Iteration 5 | Removed a stage after it added cost without improving outcome | result | removed — lesson |
| Final | Combined the changes that worked | final result table | main contribution |

Every row points to an actual run logged in `data/` so each claim is evidence-backed (ground rule 09).

## 6. Deliverables (the four required items)

1. **Solution code + README + Improvement Changelog**
   - README introduces the intended user (Studio user running a workspace task) and their current
     bottleneck (manual relay), then why solving it matters.
   - Changelog uses the table in section 5; ends with the main failure mode and the hot take.
   - Full spec lives in [`spec.md`](spec.md).
2. **Reproduction guide** (`REPRODUCTION.md`) — clean-environment walkthrough:
   - clone `fworks-tech/agenthood` + `fworks-tech/agenthood-site`, install, `npm run build` in
     agenthood, `npm install` in the site; `.env` configuration (provider key optional locally).
   - commands for the Workspaces dev server, for the baseline harness, and for the eval script;
     which data is required and what output to expect; versions + approximate runtime/cost.
3. **Solution video (<= 5 min)** — problem and baseline (manual relay), one realistic workspace run
   (Mediator → Builder → Tester → fix → done) from start to finish, the final comparison table,
   and a short changelog walkthrough highlighting the single most impactful change and one
   experiment that was removed. Screen recording of the 3-zone layout (sidebar status + live
   chat + user intervention).
4. **Agent trajectories** — one representative trajectory per agent used in the final solution
   (Mediator, Builder, Tester, Reviewer, etc.). Each trajectory follows the full arc:
   agent instructions (system prompt from `agentSkills`) → what the agent did → how its tools
   responded (`tool_call` / `tool_result`) → the feedback that shaped its next step → any
   retries or human checkpoints. Stored in `data/workspaces/trajectories/` as JSON event logs
   exported from the SSE stream so a judge can follow each member from its prompt to the final
   result.

## 7. Hot Take (5 pts)

A candidate we can predict now: without a **turn budget and a human veto**, a Builder+Tester team
ping-pongs — the Tester keeps finding issues, the Builder keeps patching, cost grows, outcome does
not converge. The lesson: *orchestration is not letting agents argue; it is giving them a referee
and a clock.* The evaluation's challenging case (task 10) and the convergence test (task 11) are
designed to expose exactly this so the changelog's final entry can make the point with evidence.

## 8. Roadmap (one week)

| Day | Work | Exit criterion |
|---|---|---|
| Day 0 | Confirm Workspaces scope in code; write user/bottleneck paragraphs; fix the 10+ eval cases + primary metric | translates to README + this plan |
| Day 1 | Baseline harness: drive today's 1:1 Studio flow over the same cases; record `T`, `C`, cost | baseline table exists |
| Day 2 | `WorkspaceSpec` + `workspace-orchestrator.ts`: Mediator intake + linear Builder->Tester with shared thread, no retries | first end-to-end workspace run via CLI |
| Day 3 | Add retry/stop budget + human handoff events; wire `/api/studio/workspaces` SSE | orchestrated runs converge roughly ⅔ of cases |
| Day 4 | Workspaces UI in `/studio/workspaces` (member picker, instruction input, turn cards, live logs); polish + AbortSignal stop | judged usable in-browser |
| Day 5 | Reviewer-as-gate + context distillation iterations; run full eval (baseline vs final); write changelog rows | all 10+ cases measured |
| Day 6 | Repro guide pass (clean env), trajectories export, README, report | three deliverables done |
| Day 7 | Video recording, final report, hot take; retrospective on removed experiment | submission package complete |

## 9. Known risks / open questions

> All open questions resolved on 2026-08-31. Phases 1-8 landed (`150cef7`, PR #169) — risks below reflect decisions made.

- **Site repo scope:** this work lives in `fworks-tech/agenthood-site` (public), PR #169 `frontier-hackathon` (11 commits `7268ce2..150cef7`, `main` #167 → `150cef7`).
- **Auth / abuse gates:** `/api/studio/chat` enforces Turnstile and strict validation (message
  caps: 50 msgs, 4000 chars, 100k total). Workspaces ports the same guards (`route.ts:1` `memberIds`×`getAgentById`, `instruction≤4000`) + budget cap `TURN_BUDGET_DEFAULT=10` (member activations only, Mediator free) + own `RATE_LIMITS` `middleware.ts:31` `20 req/min` + Upstash `workspaces` bucket (`middleware.ts:98`).
- **`maxDuration = 60` per turn:** client-driven loop — each member turn = separate server call (`useWorkspace.ts:1` + `route.ts:1` `maxDuration 60`). Chosen over server-side chunking for simplicity and error isolation. Proven: `npm run build` lists `/api/studio/workspaces` as dynamic, `lint` green.
- **Context window:** full thread, trimmed oldest-first to 100k chars (`workspace-orchestrator.ts:1` `trimThread`); output uncapped (no `maxTokens`) so Builder/Tester/Reviewer can read `https://github.com/fworks-tech/agenthood` without truncation — human-requested. Not an LLM summary.
- **Determinism:** LLM runs are stochastic; the eval uses the same prompts and a fixed turn budget
  and reports pass-rate over runs, not a single sample.

---

*This document is the project's memory. When the plan changes, update this file first. Last tri-sync: 2026-08-31 @ `150cef7` (Phases 1-8). Next: Phase 9 — trajectories + REPRODUCTION.md + ADR + coverage gate when re-enabling `npm test`.*

### Evidence snapshot (for judges, as of `150cef7`)

- **Branch:** `frontier-hackathon` 11 commits `7268ce2..150cef7` → https://github.com/fworks-tech/agenthood-site/pull/169 (pushed, `lint` + `build` green, `/studio/workspaces` + `/api/studio/workspaces` in `next build` output)
- **Mediation:** `the-mediator` JSON `{members:[{id,task,order}]}` parsed by `workspace-orchestrator.ts:1` `parseMediatorPlan` (strips ```json fences, whitelists `getAgentById`, falls back to `memberIds` order on malformed)
- **Uncapped research:** `workspace-adapter.ts:1` no `maxTokens`, `web_fetch`+`code_execution` unrestricted — demo `Builder+Tester+Reviewer` on `https://github.com/fworks-tech/agenthood` clones via `code_execution`, Tester audits, Reviewer synthesizes area for improvement
- **Intervention:** `useWorkspace.ts:1` `AbortSignal` pauses current turn, `sendIntervention` appends to shared thread and re-invokes Mediator immediately (`spec.md:140-142`)
- **Handoff:** `shouldRequestHandoff('code_execution')` → `workspace.handoff` `stop/continue` (`workspace-adapter.ts:1`, `workspaces/page.tsx:1` UI)
- **Budget:** `TURN_BUDGET_DEFAULT=10` `workspace-orchestrator.ts:1` `isBudgetExhausted`, counted as member activations only (Mediator free)
- **Live updates:** `stream.ts:7` `readSSEStream` with `onWorkspaceEvent` for `workspace.*` → `WorkspaceSidebar.tsx:1` status dots + `WorkspaceChatArea.tsx:1` thread + `LiveLogs.tsx` mirrored `{type:log}` with `workspaceId/correlationId` (`trace.ts:1`)