---
title: "Playground Security Hardening & Performance Improvements"
date: 2026-07-04
author: Agenthood Team
---

# Playground Security Hardening & Performance Improvements

**Date:** July 4, 2026  
**Author:** Agenthood Team

We've completed a comprehensive security and quality audit of the Studio playground — addressing SSRF protection, CSP headers, origin validation, rate limiting, React hydration errors, code quality issues, and more. Here's what changed and why.

## Security Hardening

### SSRF Protection

The Ollama `baseUrl` input now validates URLs before making requests. HTTP URLs are restricted to `localhost`, `127.0.0.1`, and `host.docker.internal` — all other HTTP targets are rejected. HTTPS URLs are allowed without restriction, ensuring only encrypted connections to external hosts.

### Content Security Policy (CSP)

A `Content-Security-Policy` header has been added to `next.config.ts`, restricting script sources, connection targets, and frame ancestors. This mitigates XSS and data exfiltration even if an injection vulnerability is discovered.

### Origin & CSRF Validation

API endpoints now validate the `Origin` header using exact origin matching (`new URL().origin`) instead of a substring `startsWith` check. This prevents origin-bypass attacks where a crafted origin like `evil-attacker.com` could previously match a prefix rule for `trusted-origin.com`.

### Logger Redaction

The structured logger (`api/studio/_lib/logger.ts`) now redacts sensitive keys — including `authorization`, `secret`, and `token` — before writing log output. Authorization headers matching the `Bearer` pattern are fully masked regardless of case.

### Model Validation

Chat requests are validated against a known set of provider models (`KNOWN_MODELS`). Requests referencing an unrecognized model are rejected before being forwarded to the upstream API, preventing misconfiguration-based errors.

## Rate Limiting

The middleware has been upgraded from a simple in-memory `Map` to `@upstash/ratelimit` backed by `@upstash/redis` (Vercel KV). Four independent rate limiters are configured for chat, agent listing, status checks, and feedback endpoints. If KV isn't configured, the system falls back gracefully to an in-memory store, making it safe for local development without extra infrastructure.

## Hydration Fixes

React hydration errors were causing repeated warnings on every page load. We moved all `localStorage` reads from `useState` initializers (which run during SSR and produce mismatches) to `useEffect` (which runs only on the client). A `hydrated` flag prevents the `ConversationList` component from rendering until data is available on the client side. Configuration persistence now uses `sessionStorage` instead of `localStorage`, with API keys managed purely in memory.

## Code Quality

| Metric | Before | After |
|--------|--------|-------|
| ESLint errors | 17 | 0 |
| ESLint warnings | 6 | 0 |
| Hydration errors | 4+ per page load | 0 |
| E2E tests passing | 57/58 | 57/58 (1 flaky mobile test under parallel load) |

Additional fixes:

- **DragHandle**: Event listener churn eliminated — the `onDrag` callback is stored in a ref, reducing effect dependencies
- **Ref mutation**: Render-phase ref writes (`conversationsRef.current`, `configRef.current`, `turnstileRef.current`) moved to `useEffect`
- **Constants**: All localStorage keys extracted to `app/(main)/studio/_lib/constants.ts`
- **Dead code**: Removed unused `AgentSidebar.tsx` (92 lines, never imported) and stale refs/state from `MobileDrawer`, `MobileBottomSheet`, and `page.tsx`

## Monitoring

- **Sentry** is now integrated across client, edge, and server runtimes — errors in the chat API are captured with context including request ID
- **Vercel Speed Insights** provides real-user Core Web Vitals monitoring (added in a parallel effort)

## What's Next

The following items remain as follow-up work:

1. **Provision Vercel KV** for the Upstash rate limiter to use its Redis backend in production (currently falls back to in-memory)
2. **Configure Turnstile secret keys** in Vercel environment variables (currently using test keys from development)
3. **Configure Sentry DSN** in production environment variables
4. **Address Vercel OIDC token rotation** (tracked as a separate security item)

## Related

- Issue [#33](https://github.com/fworks-tech/agenthood-site/issues/33) — Playground hardening tracking issue
- PR: SSRF protection, CSP headers, origin validation, model validation, logger redaction
- PR: Hydration fixes, sessionStorage config, DragHandle event churn, lint cleanup
- [Vercel Speed Insights Documentation](https://vercel.com/docs/speed-insights)
- [Sentry Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Upstash Ratelimit](https://github.com/upstash/ratelimit)
