# Spec: CAPTCHA auto-retry only on a demonstrably fresh token

## Problem

Review notes from PR #132 (merged) captured non-blocking hardenings for the CAPTCHA retry loop:

1. `refreshCaptchaAndWait` can report "ready" for the exact token the server just rejected with
   `CAPTCHA_FAILED`. If a forced reset never clears the stale value (e.g. the widget script did
   not load), the wait loops exit immediately and the retry re-sends a dead token.
2. `error-callback`/`timeout-callback` null the token while `expired-callback` deliberately keeps
   it — with no comment, a future reader may unify the two opposite behaviors by mistake.
3. e2e `__turnstileResetCount` `toBe(0)` assertions silently depend on `beforeEach`
   re-mock + reload seeding the counter.
4. The two captcha specs cast `window` inline four times.

## Proposed Solution

- `refreshCaptchaAndWait` defines "ready" as observing a token **strictly different** from the
  stale one and returns that predicate; otherwise the existing "refresh timed out, verify
  manually" path runs (single retry, no loop).
- Add the rationale comment to `error`/`timeout` callbacks in `Turnstile.tsx`.
- Add typed test helpers in `e2e/helpers.ts` (`readTurnstileResetCount`, `resetTurnstileCounter`,
  `expireAndReissue`, `setTurnstileAutoRenew`, `runTurnstileIssueResolvers`).
- Reset the counter explicitly per test and replace the inline casts.
- Chat-history's identical `expireAndReissue` cast is moved to the helper too.

## Out of Scope

- Changing the one-retry limit.
- Server-side Turnstile verification (correct; `app/api/studio/chat/route.ts` unchanged).

## Acceptance Criteria

- [ ] Auto-retry re-sends only when a fresh token was obtained; otherwise it degrades via the
      clear "refresh timed out" error/log with no retry loop
- [ ] `error/timeout-callback` nulling rationale documented in code
- [ ] `__turnstileResetCount` reset explicit per test
- [ ] Inline `window as unknown as` casts removed from the captcha specs and chat-history
- [ ] Lint, unit (227), and full e2e pass (esp. `captcha-expiry`, `captcha-save`, `chat-history`)

## Testing Strategy

- **E2E:** existing specs keep asserting (a) successful auto-retry requires a widget reset
  (`greaterThan(0)`) and (b) a widget that cannot re-issue tokens leads to the timeout path with
  exactly two chat requests — both now read through typed helpers with an explicit counter reset.
- **Unit:** no new unit needed — the retry semantics are exercised end-to-end by the specs.

## Open Questions

None.