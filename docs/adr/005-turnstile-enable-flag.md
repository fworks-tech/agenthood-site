# ADR-005: `NEXT_PUBLIC_TURNSTILE_ENABLED` as the single source of truth for CAPTCHA gating

**Date:** 2026-08-19
**Status:** Accepted

## Context

CAPTCHA gating was derived independently on the client and server, each from a different
combination of env vars:

- **Client** gated on `NEXT_PUBLIC_TURNSTILE_SITE_KEY` alone (`GuestCommentForm`'s
  `CAPTCHA_REQUIRED`, the playground send guard, and the widget's render-null).
- **Server** gated on `TURNSTILE_SECRET_KEY && NEXT_PUBLIC_TURNSTILE_SITE_KEY` (chat route's
  `validateTurnstile`, news comments' `verifyTurnstile`).

In a half-configured production deployment (site key set, secret missing), the client required a
captcha the server never verified: friction without protection. The secret is server-only and
cannot be read by the client, so there was no way for the two sides to agree on "is CAPTCHA
required?" purely from the existing vars.

## Decision

Introduce `NEXT_PUBLIC_TURNSTILE_ENABLED` (`"true"` default, `"false"` disables) as the single
"captcha required" source of truth, read by both client and server:

- Client requires a token only when `ENABLED && SITE_KEY` (site key still required so the gate
  is always satisfiable).
- Server enforces verification only when `ENABLED && SECRET && SITE_KEY`.
- When `ENABLED` but misconfigured (secret or site key missing), the server logs
  `turnstile.config_missing` and either fails open or closed according to `TURNSTILE_REQUIRED`
  (see the amendment below).

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Derive gating from existing keys (status quo) | No new config | Client/server disagree when half-configured; no off switch | The very gap this ADR fixes |
| Fail closed when enabled-but-misconfigured | Strict enforcement of intent | Turns a config typo into a full chat/comments outage | Availability first; a misconfigured control must not take the site down |
| Server-only flag that mirrors the secret | Single server source | Client still cannot know it (not `NEXT_PUBLIC_`) | Fails the parity goal |

## Consequences

- **Easier:** explicit disable (`NEXT_PUBLIC_TURNSTILE_ENABLED=false`) reliably turns CAPTCHA off
  end-to-end; client/server behavior is now consistent across full/half/none config states.
- **Harder:** an extra env var to document and keep in sync across environments; a misconfigured
  deployment may silently run without CAPTCHA (mitigated by the loud `config_missing` log).
- **Risk:** deployments that relied on implicit gating must add the flag only if they intend to
  disable CAPTCHA; the default (`"true"`) preserves existing behavior.

## Amendment (2026-11-25)

`TURNSTILE_REQUIRED` defaults to `"true"` and is the single server-side switch for the fail-closed
behavior. With `NEXT_PUBLIC_TURNSTILE_ENABLED=true` and `TURNSTILE_REQUIRED=true`, a missing secret
or site key now returns an error instead of accepting the request. The same gate covers workspace
turns and the Jev bridge. Setting `TURNSTILE_REQUIRED=false` restores the original fail-open
behavior. This reverses the availability-first choice recorded above: an unauthenticated paid or
write endpoint is the larger risk.

## References

- Issues fworks-tech/agenthood-site#97, #103, #113, #345; `app/components/Turnstile.tsx`,
  `app/components/GuestCommentForm.tsx`, `app/(main)/studio/playground/page.tsx`,
  `app/api/studio/chat/route.ts`, `app/api/news/comments/route.ts`.
