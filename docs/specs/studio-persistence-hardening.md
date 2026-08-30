# Spec: Studio Persistence Hardening

## Problem
`useStudioChat` streaming path persisted state via `persistTokens` — a closure capturing stale `baseTokens`/`estimatedTokens` and calling `saveConversations` inside `setConversations(prev=>)` functional updaters. Concurrent `onToken`/`onToolResult`/`onDone` callbacks raced: `persistTokens(updateMessage(prev,...))` wrote `tokenCount: baseTokens+estimatedTokens` while `localStorage` was overwritten multiple times per stream, clobbering in-flight messages and token counts (ADR-008:29 slated removal for Phase 2). Second blocking issue: `retrySendMessage` handled `CAPTCHA_FAILED` as generic error writing literal `Error: CAPTCHA_FAILED` bubble, while `sendMessage` correctly removed placeholder; this left duplicate assistant messages after CAPTCHA expiry and broke `e2e/captcha-expiry.spec.ts` single-retry contract.

## Proposed Solution
Keep PR #163 decomposition; harden hot path only:
- Replace `persistTokens` with pure `withTokenCount(convs)` (no `saveConversations`) and explicit `saveConversations(final)` outside the mapping but inside the same functional updater.
- `onDone`/`onError` compute `updated = updateMessage(prev, ...)` then `final = withTokenCount(updated)` then `saveConversations(final)`.
- Unify `handleCaptchaFailed` across `sendMessage` and `retrySendMessage` — both remove placeholder via `conversationsRef.current` filter + `saveConversations(cleaned)` + `setConversations(cleaned)`.
- DRY generic error path: `setConversations(prev => { const updated = updateMessage(prev, ..., errorMsg); saveConversations(updated); return updated; })` (no tokenCount mutation; `baseTokens` snapshot stays as-is until next successful stream).

## Out of Scope
- Changing one-retry limit, `vm` sandbox (`tools.ts`), markdown export escaping beyond existing `sanitizeForCodeBlock`, `vm` → `isolated-vm`, `src/skills` path fix, provider failover (`LLMRouter`), `TURNSTILE_REQUIRED` env divergence (deferred to `fix/agenthood-provider-failover`).

## Acceptance Criteria
- [ ] `grep -R persistTokens app/` → 0 hits
- [ ] `sendMessage` and `retrySendMessage` CAPTCHA failure both remove placeholder (no `Error: CAPTCHA_FAILED` bubble); `page.tsx` `refreshAndWait` single retry works
- [ ] Interleaved `onToken`×N → `onToolResult` → `onDone` leaves `localStorage` final `tokenCount = baseTokens+estimatedTokens` and full `streamedContent`
- [ ] `npm run lint` clean, `npm run build` 143/143, `npm test` 31/270 pass (hooks-useCaptcha etc.)
- [ ] `gh pr checks 163` green

## Testing Strategy
- Unit: new `__tests__/useStudioChat-persistence.test.ts` (jsdom, fake timers, `localStorage` mock) covering race and CAPTCHA cleanup equivalence
- Existing: `hooks-useCaptcha`, `hooks-useConversationExport`, `turnstile` + correlation tests
- E2E: `captcha-expiry.spec.ts` hidden-always + single retry assertions

## Open Questions
- `TURNSTILE_REQUIRED` client (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`) vs server (`TURNSTILE_REQUIRED` env) divergence remains a deploy foot-gun — document but do not change env contract here.
