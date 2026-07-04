---
title: "Feedback API, News Section, and Observability Improvements"
date: 2026-07-04
author: Agenthood Team
---

# Feedback API, News Section, and Observability Improvements

**Date:** July 4, 2026  
**Author:** Agenthood Team

We've shipped several new features and improvements across the Studio playground and the site as a whole. Here's what's new.

## Feedback API

The playground now supports thumbs-up / thumbs-down feedback on individual chat responses. Each message bubble has a feedback button that saves preference locally and posts to a new `POST /api/studio/feedback` endpoint for server-side collection. The endpoint is rate-limited at 60 requests per minute and logs all feedback events for future analysis.

## News Section

The site now has a complete news publishing system:

- **`/news`** — reverse-chronological listing of all posts with title, date, author, and summary
- **`/news/[slug]`** — individual article pages built at compile time (static generation)
- **`/news/rss.xml`** — RSS 2.0 feed for external readers

The navigation bar and breadcrumbs have been updated with a News link. Three articles are published so far: the Academy outage post-mortem, Speed Insights announcement, and playground hardening report.

## Analytics Enrichment

The existing `@vercel/analytics` integration now captures richer event data:

| Event | New Fields |
|-------|-----------|
| `message_sent` | `conversationId` |
| `message_completed` | `tokenCount` |
| `config_changed` | `temperature`, `maxTokens` |
| `conversation_deleted` | — (new event) |
| `nav_click` | Destination page label |

This allows better understanding of user behavior — how many tokens per conversation, what configurations users choose, and which navigation paths are most used.

## Observability & Logging

Structured logging has been added across the stack:

- **Middleware** — logs CORS rejection origins, rate-limit hits, and Upstash fallback events
- **Feedback route** — logs validation failures and parse errors
- **News pages** — logs manifest read failures, page renders, and 404s
- **MessageBubble** — logs feedback submission failures client-side

## Hardening Follow-ups

The remaining items from the playground hardening audit have been addressed:

- **Environment variables** documented in `.env.example` — Turnstile keys, Sentry DSN, and Upstash KV credentials now have commented entries with setup instructions
- **Vercel OIDC tokens** — stale references removed from local env files; tokens rotated on Vercel dashboard
- **Flaky E2E test** — the `config restored on page reload` mobile test no longer races with CSS transitions
- **Lint** — final 2 warnings eliminated (unused `configPanelHeight` state from a previously commented-out DragHandle)
- **News tests** — updated to expect 3 manifest entries, with proper XML entity encoding in RSS title checks

## E2E Test Coverage

Test suites have been added for the new features:

- **News** — manifest parsing, file existence, date validation, RSS generation, and content rendering
- **Playground** — message sending, agent rendering, stream markers, and error states
- **Feedback** — API validation, rate limiting, and event logging

All **51 tests pass** across 8 suites.

## Related

- [Issue #31 — Feedback API](https://github.com/fworks-tech/agenthood-site/issues/31)
- [Issue #30 — News section](https://github.com/fworks-tech/agenthood-site/issues/30)
- [Issue #11 — Analytics](https://github.com/fworks-tech/agenthood-site/issues/11)
- [Issue #33 — Playground hardening](https://github.com/fworks-tech/agenthood-site/issues/33)
- [Vercel Analytics](https://vercel.com/docs/analytics)
