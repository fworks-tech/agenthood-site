# Spec: Agenthood Workspaces

> **Status:** Phases 1-10 landed on `frontier-hackathon` @ `facb31d` (PR #169 — 15 commits to `facb31d`). Reliable session memory + auto-synthesizer landed.
> Date: 2026-09-01. Tri-synced with `HACKATHON-PLAN.md` and `worklog.md` (uncapped tokens, budget 30 = member activations only, workspaceId on every log, single scrollbar, structured scratchpad).

---

## Problem

Studio Playground users who want multi-agent collaboration (implement + test + review) must
manually copy-paste output between single-agent conversations, losing context at every hop.
The chain of reasoning across members is invisible and un-replayable. There is no in-product
way to see agents coordinate.

## Proposed Solution

A new `/studio/workspaces` page that lets users assemble a team of Society members, give a
single instruction, and watch them collaborate in a live shared thread — with The Mediator
(`the-mediator`) automatically conducting the delegation.

### Page Layout (3 zones)

```
┌──────────────┬──────────────────────────────────────┐
│   Sidebar    │           Live Chat (main)           │
│              │                                      │
│  Agent Cards │  The Mediator: "I'll route this..."  │
│  with status │  The Builder: "Implementing..."      │
│              │  The Tester: "Running tests..."      │
│  🔀 Mediator │  The Builder: "Fixing failures..."   │
│    thinking  │  The Reviewer: "Reviewing code..."   │
│  🛠️ Builder  │                                      │
│    working   │  You: "Also check edge cases"        │
│  🧪 Tester   │  The Builder: "Done."                 │
│    idle      │                                      │
│  🔍 Reviewer │                                      │
│    waiting   ├──────────────────────────────────────┤
│              │  [Instruction / message input]        │
└──────────────┴──────────────────────────────────────┘
```

**Left sidebar:** selected agent cards with live status indicators (idle → thinking → working
→ waiting → done). The Mediator is always listed first. Smooth CSS transitions on status
changes (same animation quality as the Playground).

**Main area:** live group chat thread — all selected members contribute here in real time. Each
message is tagged with the member's icon, name, and turn number. The chat shows **only the
polished answer** — no tool markers, routing JSON, or technical one-liners (stripped by
`_lib/workspace-polish.ts` `toPolished`, shared by the card and the thread sent to the next
member). Under each message, ChatGPT-style actions: like/dislike (posts to
`/api/studio/feedback/`), copy, and **View logs** — a per-message dialog exposing the tool calls
(collapsible args/result/error), polished content, and raw content. Markdown renders via
`ReactMarkdown` + `remark-gfm` with explicit `pre/code/h1-3/strong/a` components. The user can
step in and send messages at any point during the run. Messages use the same `AnimatedMessage`
fade/slide wrapper the Playground uses.

**Bottom:** instruction input (multiline textarea). Before the run starts, this is where the
user writes the initial instruction. During the run, it becomes a chat input where the user can
intervene. Same `ChatComposer` feel — Enter to send, Shift+Enter for newline, stop button
while streaming.

### Member Picker Flow

1. Page loads → shows the same card grid as the homepage (grouped by category: Engineering,
   Validation, Lifecycle, Knowledge), using the same `agents` array from `_data/agents.ts`.
2. Cards are **clickable** — toggle select/deselect. Selected cards get an indigo border
   (`border-indigo-500`) with a smooth transition (same timing as Playground hover states).
3. The Mediator (`the-mediator`) is **not shown in the grid** — it is always auto-included as
   the conductor.
4. When ≥1 member is selected → the instruction textarea fades in below the grid.
5. User writes instruction → clicks "Start Workspace" → the picker collapses with a slide
   transition, the 3-zone layout (sidebar + chat + input) takes over.

### Default Configuration (server-side)

No client-side config panel. The server applies defaults:

| Setting | Value | Source |
|---------|-------|--------|
| Provider | `opencode-go` | Default from `getDefaultModel()` |
| Model | `getDefaultModel('opencode-go')` | `_types/studio.ts` |
| Temperature | `0.7` | Same as Playground default |
| MaxTokens | uncapped (provider max, no `maxTokens` param) | Workspace uncapped for full research — Builder/Tester/Reviewer can fetch repos, read files, write code without truncation |
| Enabled tools | `web_fetch`, `code_execution` | Same as Playground, unrestricted for repo research |

The API key follows the same server-side `OPENCODE_API_KEY` / fallback chain the Playground
uses. No BYOK for Workspaces (simplifies the flow).

### Orchestrator State Machine

The workspace orchestrator (`workspace-orchestrator.ts`) is a state machine over one shared
thread:

```
[User submits instruction]
        │
        ▼
┌─────────────────┐
│  MEDIATOR_TURN  │  Mediator classifies intent, produces delegation plan
│  (always first) │  JSON: { members: [{ id, task, order }] }
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MEMBER_TURN    │  Execute next member from the plan
│  (dispatch)     │  Member sees: own system prompt + shared thread context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MEMBER_RESULT  │  Member completes (pass / fail / handoff / budget-exhausted)
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
 pass     fail/handoff
    │         │
    │    ┌────┴────────────┐
    │    │                 │
    │  budget left    budget exhausted
    │    │                 │
    │    ▼                 ▼
    │  re-delegate      STOP (budget)
    │    │
    ▼    ▼
┌─────────────────┐
│  NEXT_MEMBER    │  Or: all done → STOP
│  (or done)      │
└─────────────────┘
```

**Stop conditions:**
1. All members complete their turns (all pass)
2. Turn budget exhausted (default: 30 member activations — was 10, aligned to code `TURN_BUDGET_DEFAULT=30`)
3. Human stops the run (AbortSignal from the input bar)
4. A member requests a human checkpoint (emits `workspace.handoff`)

**Shared context & reliable session memory:** each member receives its own `agentSkills` system prompt + the shared
thread (full thread, trimmed oldest-first to 100k chars). Not an LLM summary; simple trim keeps most recent context.
The thread plus a structured scratchpad lives in a reliable session object `WorkspaceSession {workspaceId, spec, thread, messages, statusMap, memory:{goal, scratchpad, decisions, artifacts}, budgetLeft, turnCounter}`. Stored in `workspace-store.ts` — server `globalThis Map` + client `localStorage` mirror (`STORAGE_KEYS.WORKSPACES/ACTIVE_WORKSPACE`, TTL 45m, cap 20, interface ready for future Redis). All members see prior replies; `GET /api/studio/workspaces?workspaceId=` rehydrates after reload. This fixes the "second message wiped history" bug (`page.tsx: hasStarted guard + store hydrate`).

**Auto-synthesizer (Claude-Work style):** after *every* agent message, `workspace-synthesizer.ts` streams a natural final answer via `opencode-go` over the full thread (`workspace.synthesized` events) into a violet `Synthesis` card below the thread — additive, not replacing raw cards. Budget-free, additive to member cards.

**Human checkpoints:** before `code_execution` tool calls, the orchestrator pauses and emits
`workspace.handoff` with a stop/continue choice. Satisfies ground rule 04.

**User intervention:** when the user sends a message mid-run, the current member is paused
(AbortSignal) and the Mediator immediately re-evaluates the delegation plan with the new
input. The user's message is appended to the shared thread before the Mediator re-plans.

### SSE Event Vocabulary

Extends the existing NDJSON stream with `workspace.*` events:

| Event | Payload | Purpose |
|-------|---------|---------|
| `workspace.started` | `{ instruction, members[] }` | Workspace begins |
| `workspace.turn_start` | `{ memberId, role, turnIndex, plan?: { task: string } }` | Member begins its turn (plan included for Mediator's first turn) |
| `workspace.token` | `{ memberId, data }` | Streamed output from current member |
| `workspace.tool_call` | `{ memberId, id, name, args }` | Member invokes a tool |
| `workspace.tool_result` | `{ memberId, id, name, result, error? }` | Tool execution result |
| `workspace.turn_end` | `{ memberId, decision: "pass" \| "handoff" \| "failed", cost? }` | Member completed |
| `workspace.status` | `{ memberId, status: "idle" \| "thinking" \| "working" \| "waiting" \| "done" }` | Sidebar status update |
| `workspace.handoff` | `{ memberId, reason, options: ["continue", "stop"] }` | Awaiting human decision |
| `workspace.done` | `{ totalCost, turns, result }` | Workspace complete |
| `workspace.error` | `{ data }` | Error occurred |
| `workspace.synthesized` | `{ data }` | Synthesizer token (final natural answer) |
| `workspace.synthesized_start/end` | `{ workspaceId, correlationId }` | Synthesis lifecycle |

Plus the existing `{ type: "log" }` events mirrored for the LiveLogs panel (reuse
Logger/correlation-id conventions).

### API Contract

**POST** `/api/studio/workspaces`

```typescript
// Request
interface WorkspaceRequest {
  memberIds: string[];    // selected member IDs (excluding the-mediator)
  instruction: string;    // user's initial prompt
}

// Response: SSE stream (NDJSON)
// Events follow the workspace.* vocabulary above
```

**Guards (ported from chat route):**
- `memberIds` must be a non-empty array of valid agent IDs (via `getAgentById`)
- `instruction` required, max 4000 chars
- No Turnstile required (internal tool, same as Playground with `TURNSTILE_ENABLED=false`)
- Rate limit: own entry in `RATE_LIMITS` (`app/middleware.ts`)
- `maxDuration`: **60 per turn** — client-driven loop (each member turn = separate server call);
  the workspace orchestrator runs on the client, calling the API for each turn individually

**Server-side defaults applied** — no provider/model/temperature/maxTokens in the request body.

### File Tree (as landed, `main..frontier-hackathon` 31 files +~550/-45, PR #169 `facb31d`)

```
app/(main)/studio/workspaces/
  page.tsx                                        # 3-zone layout (picker → sidebar+chat+input, LiveLogs+MobileDrawer) — flex-1 min-h-0 single scrollbar, hasStarted guard
  _components/WorkspaceComposer.tsx               # grid by _data/agents.ts:23-43, cursor-pointer, stagger, in https://… placeholder
  _components/WorkspaceChatArea.tsx               # live thread via AnimatedMessage + collapse Show N intermediate updates after 6
  _components/WorkspaceSidebar.tsx                # Mediator-first status dots + slide-in stagger
  _components/WorkspaceTurnCard.tsx               # per-member bubble + violet Synthesis card, clamp max-h-[520px] View more/less, pre wrap max-h-[420px]
  _hooks/useWorkspace.ts                          # client state machine + hydrate/persist via workspace-store, auto-synthesizer after every turn
app/api/studio/workspaces/route.ts                # POST SSE + GET ?workspaceId= rehydrate, guards, wraps started/done, maxDuration 120
app/api/studio/workspaces/synthesize/route.ts     # POST synthesis stream via LLMRouter (workspace.synthesized)
app/(main)/studio/_lib/workspace-adapter.ts       # createWorkspaceTurnStream (LLMRouter uncapped, workspace.* + log with workspaceId)
app/(main)/studio/_lib/workspace-orchestrator.ts  # parseMediatorPlan/fallbackPlan/trimThread/budget helpers
app/(main)/studio/_lib/workspace-store.ts         # WorkspaceSession Map + localStorage mirror (interface ready for Redis), TTL 45m cap 20
app/(main)/studio/_lib/workspace-synthesizer.ts   # Claude-Work style synthesis prompt over thread
app/(main)/studio/_lib/stream.ts                  # readSSEStream + onWorkspaceEvent (workspace.* + synthesized)
app/(main)/studio/_lib/trace.ts                   # emitLogEvent/buildTraceEnvelope/createWorkspaceTraceMeta (workspaceId on every log)
app/(main)/studio/_lib/logger.ts                  # SAFE_LOG_KEYS +workspaceId/turnIndex/memberId
app/(main)/studio/_types/workspace.ts             # WorkspaceSpec/Status/Turn/MediatorPlan/WorkspaceEvent (13 incl. synthesized, TURN_BUDGET_DEFAULT=30, WorkspaceSession/Message)
app/middleware.ts                                 # RATE_LIMITS /api/studio/workspaces 20/min + Upstash workspaces bucket
```

### Design Quality

The Workspaces page must match the Playground's visual quality:

- **Dark theme:** same `bg-zinc-950` background, `border-zinc-800` borders, `text-zinc-*`
  typography hierarchy
- **Animations:** `AnimatedMessage` fade/slide for chat bubbles (reuse from
  `playground/_components/AnimatedMessage.tsx`), slide transitions for picker → workspace
  layout switch
- **Typography:** same font stack, heading sizes, and spacing as the Playground
- **Interactive states:** hover borders on cards (`hover:border-zinc-600`), active selection
  border (`border-indigo-500`), focus rings on inputs
- **Live Logs:** same `LiveLogs` component at the bottom with category filter, debug toggle,
  copy-to-clipboard (reuse from `studio/_components/LiveLogs.tsx`)
- **Mobile:** sidebar collapses into a drawer (same `MobileDrawer` pattern as Playground),
  chat takes full width
- **Welcome state:** when no workspace is running, show a centered welcome message (similar
  to Playground's `WelcomeTerminal`) with the workspace instructions

## Out of Scope

- **Config panel** — no provider/model/temperature selection (hardcoded defaults)
- **Cross-device / Redis persistence** — v1 is server Map + localStorage mirror (interface ready for future Redis via WorkspaceStore); no cross-device share link yet
- **Parallel member execution** — members execute sequentially (Mediator decides order)
- **File mutations** — members use tools (web_fetch, code_execution) but do not edit real files
- **Mediator as a selectable member** — always auto-included, never in the picker grid
- **WebSocket** — SSE/NDJSON over POST (same pattern as Playground)

## Acceptance Criteria

- [x] `/studio/workspaces` renders the member picker grid (same data as homepage, grouped by category) — `workspaces/page.tsx:1` + `WorkspaceComposer.tsx:1`
- [x] Clicking a card toggles selection (indigo border on selected, smooth transition)
- [x] Instruction textarea appears when ≥1 member is selected (fade-in animation)
- [x] Submitting sends `{ memberIds, instruction }` to `/api/studio/workspaces` — `route.ts:1` validates via `getAgentById` (`_data/agents.ts:76`), `instruction≤4000`
- [x] SSE stream starts; Mediator turn begins immediately — `useWorkspace.ts:1` `runTurn('the-mediator',…)` + `workspace.started` from `route.ts:13`
- [x] Mediator produces delegation plan visible in the chat — `workspace-orchestrator.ts:1` `parseMediatorPlan` (strip fences, whitelist, fallback to `memberIds` order), JSON `{members:[{id,task,order}]}`
- [x] Members execute in order determined by Mediator; each turn visible in chat — client-driven loop one POST per turn, `maxDuration 120`, `readSSEStream` `onWorkspaceEvent` (`stream.ts:7`)
- [x] Sidebar updates member status in real time (idle → thinking → working → waiting → done) — `WorkspaceSidebar.tsx:1` + `workspace.status` events
- [x] User can send messages during the run (intervention) — current member pauses, Mediator re-evaluates immediately — `useWorkspace.ts:1` `AbortSignal` + `sendIntervention` re-invokes Mediator with `thread` appended
- [x] Turn budget enforced (default 30 member activations, Mediator free; tunable) — `workspace-orchestrator.ts:1` + `_types/workspace.ts:1` `TURN_BUDGET_DEFAULT=30`, `isBudgetExhausted`
- [x] Human checkpoint emitted before `code_execution` tool calls (stop/continue choice in chat) — `workspace-orchestrator.ts:1` `shouldRequestHandoff` + `workspace-adapter.ts:1` `workspace.handoff` before `executeTool`
- [x] Run ends on: all pass, budget exhausted, human stop, or checkpoint request — `route.ts:1` + `useWorkspace.ts:1` `workspace.done/error` + `stop/continueHandoff`
- [x] Default config (opencode-go, 0.7 temp, uncapped tokens) applied server-side — `workspace-adapter.ts:1` `LLMRouter.fromConfig` (no `maxTokens`, `web_fetch`+`code_execution` unrestricted, `getDefaultModel('opencode-go')` `_types/studio.ts:1`)
- [x] `RATE_LIMITS` entry added for `/api/studio/workspaces` — `middleware.ts:31` `20 req/min`, Upstash `workspaces` bucket `middleware.ts:98`, `LIMITER_BY_KEY` `middleware.ts:122`
- [x] Visual quality matches Playground (dark theme `bg-zinc-950/border-zinc-800`, `AnimatedMessage` via `playground/_components/AnimatedMessage.tsx:1`, `LiveLogs`+`MobileDrawer`, mobile drawer) — `workspaces/page.tsx:1`
- [x] Single scrollbar: `page.tsx` `flex-1 min-h-0 overflow-hidden` + `MainLayout` `flex-1 min-h-0` so only chat scrolls; `WorkspaceChatArea` collapse `Show N` after 6, `WorkspaceTurnCard` clamp `max-h-[520px]` `View more/less` + `pre max-h-[420px] wrap`
- [x] Cursor + animations: `cursor-pointer` on all member cards/buttons, hover `scale[1.02] shadow-xl`, stagger `fade-in slide-in`, `hasStarted` guard preserves thread on follow-up sends
- [x] Reliable session memory: `workspace-store.ts` Map + `localStorage` mirror + `GET ?workspaceId=` rehydrate, `WorkspaceSession` structured scratchpad (goal/scratchpad/decisions/artifacts), any follow-up message preserves prior thread — tested via `workspace-store.test.ts` + `e2e/workspaces` intervention
- [x] Auto-synthesizer: after every agent turn `workspace-synthesizer.ts` streams Claude-Work style natural final answer via `opencode-go` into violet `Synthesis` card (`workspace.synthesized`) — additive, budget-free
- [x] Regression gate: `npm run lint` green, `npm run build` green (`next build` lists `/studio/workspaces` + `/api/studio/workspaces`); `npm test` 352 passed (incl. `workspace-store`)

## Testing Strategy

> Must satisfy `AGENTS.md:34` — tests run before any task is considered complete.
> Stack: `vitest run` (`npm test`), `playwright test` (`npm run test:e2e`), `eslint` (`npm run lint`), `next build`.

- **Regression gate (blocking):** `npm test` (252 existing unit tests), `npm run lint`, `npm run build` must stay green on every commit. No new warnings introduced; Warden threshold untouched.
- **Unit — orchestrator** (`__tests__/workspace-orchestrator.test.ts`): mock `LLMRouter` via `tests/helpers/agentFixtures.ts` (same pattern as `adapter.test.ts:1-40`). Covers: Mediator → member dispatch order, turn budget (10) enforcement, stop conditions (all-pass / budget-exhausted / AbortSignal / handoff), shared-thread trimming by max token budget, `workspace.handoff` emission before `code_execution`.
- **Unit — adapter** (`__tests__/workspace-adapter.test.ts`): verifies `workspace-adapter.ts` calls `LLMRouter.fromConfig` with server defaults (`opencode-go`, `getDefaultModel`, 0.7, uncapped), tool schemas (`web_fetch`, `code_execution` unrestricted), and SSE event mapping (`workspace.turn_start` includes plan for Mediator).
- **Unit — route** (`__tests__/workspace-route.test.ts`): mock adapter, verify guards ported from `app/api/studio/chat/route.ts` — `memberIds` non-empty + `getAgentById` whitelist, `instruction` required/max 4000 chars, rate-limit entry exists in `app/middleware.ts:31`, SSE NDJSON shape, error → `workspace.error`.
- **Unit — hook** (`__tests__/useWorkspace.test.ts`): client state machine — `workspace.started` → `turn_start`/`token`/`tool_call`/`tool_result`/`turn_end` → `done`; user intervention pauses current member (`AbortSignal`) and re-invokes Mediator; `RATE_LIMITS` signal surfaced.
- **Conventions:** reuse `tests/helpers/agentFixtures.ts` (`createMockLLM`, `createAgentHarness`); single quotes, no semicolons; no guarded `if (cond) expect(...)` assertions; assert against exported constants (e.g. `RATE_LIMITS`) not literals.
- **E2E** (`e2e/workspaces.spec.ts`): mock SSE via `e2e/fixtures.ts` (same interception as `playground.spec.ts`). Cases: picker → select ≥1 → textarea fade-in → submit → chat rendering → sidebar status (idle→thinking→working→done); user intervention mid-run (pause + Mediator re-plan); human checkpoint stop/continue; budget-exhausted banner; error banner; mobile drawer (`MobileDrawer`) collapse.
- **Coverage:** `npm run test:coverage` on the four new unit suites; target ≥80% lines on `workspace-orchestrator.ts`/`workspace-adapter.ts`/`app/api/studio/workspaces/route.ts`.

## Documentation

- **This spec** (`docs/hackathon/spec.md`) + **`HACKATHON-PLAN.md`** + **`worklog.md`** are the living docs — update them first when the plan changes (`HACKATHON-PLAN.md:349`).
- **README.md:** replace `| /studio/workspaces | #TODO |` (`README.md:21`) with real description; add Workspaces to Studio Architecture code layout and to API Endpoints table (`POST /api/studio/workspaces`).
- **REPRODUCTION.md** (new, repo root): clean-environment guide — clone `fworks-tech/agenthood` + this repo, `npm run build` / `npm install`, `.env` keys, `npm run dev` + Workspaces flow, baseline harness + `data/` eval, expected output, versions/cost. Required for Reproducibility (15 pts).
- **ADR** (`docs/adr/NNN-workspaces-orchestration.md`): record client-driven loop (60s per turn) vs server chunking, JSON plan format, full-thread trimming strategy.
- **Never edit `content/` directly** — generated by `scripts/sync-docs.mjs` / `sync-skills.mjs` (`AGENTS.md:18-20`); edit upstream or the sync scripts.
- **Changelog / trajectories:** `data/workspaces/trajectories/` JSON event logs per agent (Mediator/Builder/Tester/Reviewer) exported from the SSE stream — one trajectory per agent as required by §6.4.

## Open Questions

> All open questions resolved on 2026-08-31. Decisions below.

1. ~~**Turn budget default:**~~ **10** — conservative for 5-min demo; can tune up if runs converge faster.
2. ~~**Context distillation:**~~ **Full thread, trimmed by max token budget** — trim oldest messages when thread exceeds budget. Simple, predictable.
3. ~~**Mediator's plan format:**~~ **JSON** — member → task mapping, deterministic for the scheduler.
4. ~~**Sidebar collapse on mobile:**~~ **Yes** — collapse into drawer (same pattern as Playground's `MobileDrawer`).
