# ADR-011: Workspace Reliable Shared Memory

**Date:** 2026-09-01
**Status:** Accepted
**Relates to:** spec.md Shared context & reliable session memory, HACKATHON-PLAN.md §4 Orchestrator

## Context
Workspaces thread lived only in `useWorkspace.threadRef` (client `useRef`) and was re-sent as `thread` each `POST /api/studio/workspaces` (route.ts:78). `page.tsx:34` `start()` on `done` wiped `messages/threadRef`, so second message deleted history (screenshots 1-5). Refresh lost all. No server store; `STORAGE_KEYS` had no workspace keys; `spec.md:237` marked localStorage out of scope.

## Decision
Add `WorkspaceSession` structured scratchpad as main source of truth, stored via `workspace-store.ts` with pluggable `WorkspaceStore` interface:
- **Server:** `globalThis.__workspaceStore` `Map<workspaceId, WorkspaceSession>` (single-instance Vercel)
- **Client:** `localStorage` mirror (`STORAGE_KEYS.WORKSPACES/ACTIVE_WORKSPACE`), TTL 45m, cap 20, prune
- **API:** `GET ?workspaceId=` rehydrates; `POST` upserts `thread` from client (client source of truth)
- **Hook:** `useWorkspace` hydrates on mount, persists every `messages/statusMap` change
Future Redis swaps the `Map` via same interface without changing callers.

## Alternatives Considered
| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Redis/Upstash now | Durable cross-instance, cross-device | Extra infra, cost, latency for hackathon single-instance | Defer to v2 — interface already ready |
| No store, keep stateless | Simple | History lost on follow-up/refresh, agents cannot see prior replies | Fails acceptance |
| Only localStorage | Survives reload | Not visible server-side for rehydrate, not shared across server instances | Needs server Map anyway |

## Consequences
- Follow-ups preserve thread for all members; reload rehydrates within TTL.
- In-memory Map lost on server restart — acceptable for hackathon; Redis will fix.
- TTL/cap prevents unbounded growth; oldest evicted first (mirrors `trimThread 100k`).

## References
- `app/(main)/studio/_lib/workspace-store.ts`, `app/api/studio/workspaces/route.ts:GET/POST`, `app/(main)/studio/_hooks/useWorkspace.ts:hydrate/persist`, `__tests__/workspace-store.test.ts`
