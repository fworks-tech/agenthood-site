# Spec: Workspace Live Chat (Watch-by-Default)

Closes #290.

## Problem

Workspace runs a one-shot mediator plan then round-robins a fixed member list
(`useWorkspace.ts` start/sendIntervention) and stops. After every member answer
the user must manually intervene. Synthesis runs once at the end and cannot be
summoned on demand. There is no way to address a member directly (`@`) or pause
for a question from a member (`@user`).

## Proposed Solution

Make watch-by-default the only mode — no on-switch. After every turn a
lightweight router picks the next member with a heuristic routing score and
auto-continues. Commands and mentions are parsed locally in the composer.
Scores are fixed decision weights (95 lane mention, 78 chain successor, 60
mediator fallback, 100 direct @-mention) — not calibrated probabilities.

1. **Router** — new pure `workspace-router.ts`: chain successor from the
   existing `ORCHESTRATION_GUIDE` (`system-prompt.ts`), `talk to The X`
   mention parse, else mediator re-plan returning `{next_id, confidence,
   reason}` constrained to `spec.memberIds`. Thresholds: `>=70` auto,
   `50-69` inline Continue/Stop card (existing handoff UI), `<50` stop +
   synthesize. Caps: 8 auto-hops, no same-member 3x, stop on blocking/failed.
2. **Routed event** — `workspace.routed {from,to,confidence,reason}` added to
   `WorkspaceEvent` (`_types/workspace.ts`), emitted from `useWorkspace.ts`
   loop, rendered as a pill in `WorkspaceTurnCard`. Existing
   `turn_start/token/turn_end/status/handoff/synthesized` SSE stream is the
   watch feed — no new endpoint, no WatchPanel (Vercel-safe). Thread hygiene
   (production incident): thinking-only or empty turns never enter the shared
   thread — one auto-retry with a "final answer only" nudge, then stop and
   synthesize from real content, so a bare `...` can never read as
   conversation or be misattributed to the user.
3. **Commands** — new pure `workspace-commands.ts`, intercepted in
   `workspaces/page.tsx handleSend` before `start/sendIntervention`:
   `/summarize` (existing `runSynthesis`, no thread pollution), `/continue
   [hint]`, `/retry` (re-run last turn), `/stop`+`/new` (aliases),
   `/help` (static), `/plan` (mediator only). Unknown `/` never hits the LLM.
   Empty pings (blank or only dots) are answered inline, never routed.
4. **Mentions** — new pure `workspace-mentions.ts`: `@the-builder ...`
   routes straight to `runTurn(target)` with a 100 heuristic score, mediator skipped.
   Multi-mention runs in written order under the same budget. Unknown `@`
   errors inline. Autocomplete is a datalist over `selected`, not a new editor.
5. **HITL `@user`** — member output containing `@user` (or question + low
   confidence) emits `workspace.awaiting_user`, pauses the loop in `handoff`
   state. One 90s client nudge max
   (`runTurn(sameMember, "no reply — continue with best assumption")`), then
   synthesize + stop.
6. **Notify** — local `Notification` API on ask-inline / `@user` / done, only
   when `document.hidden`, permission toggle next to composer, default off.
7. **Autocomplete** — pure `workspace-complete.ts` suggests valid `/`
   commands and `@` roster members for the trailing token as the input
   changes; Tab or click applies, Enter still sends, Esc dismisses.

## Out of Scope

- Separate Watch Mode switch; replay/history panel; Redis-backed store and
  durable Web Push (VAPID + `sw.js` + KV subscriptions) — all Phase 2, tracked
  in #290, built only after the 8-hop live feed proves useful.
- Pause/interrupt control beyond existing `stop()`; cross-workspace events.

## Acceptance Criteria

- [ ] One instruction triggers >=2 member turns with heuristic-score pills,
      zero manual sends.
- [ ] `>=70` auto-continues, `50-69` shows inline Continue/Stop, `<50` stops +
      synthesizes.
- [ ] `@member` skips the mediator in the trace; unknown `@`/`/` never hits LLM.
- [ ] `@user` pauses, notifies, nudges once after 90s, then synthesizes + stops.
- [ ] Thinking-only turns never enter the thread; one auto-retry, then stop.
- [ ] Empty pings answered inline with zero LLM calls.
- [ ] `/summarize` mid-chain returns a card without appending to the thread.
- [ ] Typing `/` or `@` suggests only valid commands/members; Tab applies.
- [ ] `npm test`, `npm run lint`, `tsc --noEmit` green.

## Testing Strategy

- **Unit (Vitest):** router successor/mention/thresholds/loop-guards; commands
  parse/unknown/args; mentions multi-order/unknown. Extend `workspace.test.ts`,
  `workspace-orchestrator.test.ts`, `workspace-polish.test.ts`.
- **E2E (Playwright):** happy auto-chain, `@`-direct (no mediator turn),
  HITL timeout, `/summarize` + `/retry`.
- **Command:** `npm test`, `npm run lint`, `npm run test:e2e`.

## Open Questions

- 90s nudge delay and 8-hop cap are guesses — tune after real sessions.
- Full Web Push shape (VAPID, KV schema) deferred to Phase 2 with its own ADR.

## References

- Issue fworks-tech/agenthood-site#290; ADR-011 (shared memory), ADR-012
  (auto-synthesizer); `ORCHESTRATION_GUIDE` in `_lib/system-prompt.ts`.
