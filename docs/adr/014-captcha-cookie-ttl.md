# ADR-014: CAPTCHA cookie TTL 24h → 4h

**Date:** 2026-11-26
**Status:** Accepted
**Supersedes:** ADR-010 (cookie TTL only; the one-shot mechanism is unchanged)

## Context

ADR-010's one-shot signed cookie (`captcha_verified`, `Max-Age=86400`) lets one
passed challenge authorize 24h of chat, workspaces, synthesize and paid Jev
proxy calls. The public Studio routes carry paid-LLM cost per call, and the
per-IP rate limit keys on a spoofable header — so one solve bought a full day
of subsidized inference for anyone sharing the secret.

## Decision

- `CAPTCHA_COOKIE_MAX_AGE` 86400 → 14400 (4h) in
  `app/(main)/studio/_lib/captcha.ts`.
- No mechanism change: same `1:<expiry>:<HMAC>` value, same one-shot gate in
  `validateTurnstile`, same `CAPTCHA_FAILED` fallback.
- Re-solve scoping per paid endpoint (`tools/execute`, `workspaces/jev`) stays
  a follow-up.

## Consequences

- Easier: abuse window per solve shrinks 6x; legitimate multi-turn sessions
  (minutes to a few hours) are unaffected.
- Harder: long-lived browser sessions re-verify up to 6x daily.
- Risk: none to availability — expiry only forces a fresh Turnstile check.

## References

- ADR-005, ADR-010, `app/(main)/studio/_lib/captcha.ts`,
  `__tests__/turnstile.test.ts`.
