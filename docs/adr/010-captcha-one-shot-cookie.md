# ADR-010: One-shot CAPTCHA with a signed session cookie

**Date:** 2026-08-31
**Status:** Accepted

## Context

Turnstile tokens are single-use: once the server calls `siteverify`, the same token can never be
verified again. The Studio playground sent a fresh token per chat message, so the second message
arrived with an already-consumed or expired token. The server returned `CAPTCHA token expired`,
the client entered `refreshAndWait` → `reset` → re-issue loop, which timed out in production and
left the widget stuck on "Verifying..." with the checkbox re-appearing unchecked. Multi-turn
conversations were effectively impossible.

Requiring a token per request is also redundant: after the first successful verification the same
human has already passed Cloudflare's challenge for this browser session.

## Decision

Verify CAPTCHA **once per browser**, then replace per-request tokens with a short-lived, signed
cookie:

- On the first successful `siteverify` (chat or tool-execute route), set
  `captcha_verified=<sig>` with `Max-Age=86400; SameSite=Lax; HttpOnly` (+ `Secure` in
  production).
- The cookie value is `1:<expiryUnixSeconds>:<HMAC-SHA256(TURNSTILE_SECRET_KEY, "v1:<expiry>")>`.
- Server-side `validateTurnstile(token, verifiedCookie)`:
  - If a valid, unexpired signed cookie is present → skip `siteverify` entirely.
  - Else require a fresh token and verify it exactly once.
  - An unsigned or forged cookie is **not** accepted (no legacy grace window — the cookie was
    never deployed before this ADR).
- The playground hides the widget after the first verification (`visible={!verified}`) and stops
  sending tokens on subsequent requests.
- The `CAPTCHA_FAILED` → refresh → `retrySendMessage` path is retained as a fallback for
  cookie-less clients (e.g. Playwright mocks, third-party tools) and for genuine token expiry.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Keep per-message tokens with auto-refresh | No cookie to secure | Single-use tokens still 400 on multi-turn; refresh loop timed out in production | The reported bug |
| Accept unsigned `captcha_verified=1` | Trivial | Any client can forge the header and skip CAPTCHA for 24h | Security hole |
| Server-side session store instead of cookie | Tamper-proof | Requires KV/session infra for a control that is cheap to sign | Overkill |

## Consequences

- **Easier:** multi-turn chat works; the captcha is asked exactly once per browser and never
  re-appears mid-conversation; the widget is fully hidden after first check.
- **Harder:** every deployment must set `TURNSTILE_SECRET_KEY` (already required to verify);
  the cookie relies on the same secret as `siteverify`, so it inherits its rotation story.
- **Risk:** cookies can be cleared/disabled — the `CAPTCHA_FAILED` fallback still surfaces the
  widget for re-verification rather than silently blocking sends. Expiry is 24h, so a returning
  visitor re-verifies at most daily.

## References

- ADR-005 (the enabling flag this builds on); `app/(main)/studio/_lib/captcha.ts`,
  `app/api/studio/chat/route.ts`, `app/api/studio/tools/execute/route.ts`,
  `app/(main)/studio/playground/page.tsx`; fworks-tech/agenthood-site#166.