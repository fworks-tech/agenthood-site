# ADR-009: Studio Persistence Hardening (pull forward from ADR-008 Phase 2)

**Date:** 2026-08-30
**Status:** Accepted

## Context
ADR-008 decomposed `app/(main)/studio/playground/page.tsx` (970 lines) and proposed Phase 2 to remove `persistTokens` concurrency race: duplicated `sendMessage`/`retrySendMessage`, stale `conversationsRef.current` reads inside functional updaters, and `saveConversations` side-effects. Reviewer `dec-1788056632289` flagged two `[blocking]` findings on PR #163: `persistTokens` writes unconditionally and can clobber in-flight state; retry `CAPTCHA_FAILED` leaves literal error bubble + duplicate placeholder. Both block merge and ADR-008:29 slated fix was not yet implemented.

## Decision
Pull forward minimal hardening to `fix/issue-162-studio-persistence-race` (stacked on `refactor/issue-162-studio-playground-decomposition`):
- Replace `persistTokens` with pure `withTokenCount` + explicit `saveConversations` in `onDone`/`onError`.
- Unify `handleCaptchaFailed` to remove placeholder in both `sendMessage` and `retrySendMessage`.
- DRY generic error persistence (no tokenCount mutation on error).

## Alternatives Considered
| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Keep `persistTokens` + add `useEffect` watcher on `conversations` to persist | Centralizes persistence | Still races; watcher persists per-token intermediate states | Adds complexity without removing side-effect inside updater |
| Defer entirely to Phase 2 facade (`useConversations` + `useTokenCount`) | Clean separation | Leaves blocking race on mainline, blocks PR #163 merge | Violates safest approach — merge blocked |
| Remove `saveConversations` from streaming path entirely | No race | Loses durability on refresh mid-stream | Requires larger refactor out of scope |

## Consequences
- Enables merge of PR #163 with one `localStorage` write per `onDone`/`onToolResult`/`onError` instead of per-token.
- `retrySendMessage` now matches `sendMessage` CAPTCHA contract: single retry via `page.tsx:refreshAndWait`.
- No change to `TURNSTILE_REQUIRED` semantics or provider failover — follow-up branches handle those.

## References
- ADR-008, `docs/specs/studio-persistence-hardening.md`, `docs/specs/captcha-retry-hardening.md`, `useStudioChat.ts:265-467`
