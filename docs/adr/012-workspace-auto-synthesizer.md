# ADR-012: Workspace Auto-Synthesizer (Claude-Work Style Final Answer)

**Date:** 2026-09-01
**Status:** Accepted
**Relates to:** spec.md Auto-synthesizer, workspace-store memory

## Context
`workspace-polish.ts:toPolished` only stripped tool markers; final UX was N raw `WorkspaceTurnCard`s. Users expected a single natural final answer like Claude Work. Requirement: synthesizer must run automatically on every message sent by an agent.

## Decision
Add `workspace-synthesizer.ts` — LLM synthesis prompt over full `thread` via same provider `opencode-go` (`getDefaultModel`) — streamed as `workspace.synthesized` events from new `POST /api/studio/workspaces/synthesize` into a violet `Synthesis` card (`WorkspaceTurnCard` synthesizer variant) after every `runTurn` round (budget-free). Thread cards stay visible (collapsed via `Show N`); synthesis is additive.

## Alternatives Considered
| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Heuristic concat of last useful card | No LLM cost, deterministic | Still raw, not natural; fails "like Claude Work" | Insufficient quality |
| Synthesize only on explicit "summarize" | Cheaper | Misses requirement "on every message" | Violates spec |
| Integrate synthesis inside `createWorkspaceTurnStream` | Single POST | Couples member turn and synthesis, harder to test/abort | Keep separate route for isolation; client orchestrates |

## Consequences
- One extra LLM call per workspace run (not per turn batch) — latency + cost, but natural final answer.
- Synthesis failures are non-blocking (card removed).
- Future `memory.scratchpad` can feed richer synthesis.

## References
- `app/(main)/studio/_lib/workspace-synthesizer.ts`, `app/api/studio/workspaces/synthesize/route.ts`, `app/(main)/studio/_hooks/useWorkspace.ts:runSynthesis`, `app/(main)/studio/workspaces/_components/WorkspaceTurnCard.tsx:synthesizer`
