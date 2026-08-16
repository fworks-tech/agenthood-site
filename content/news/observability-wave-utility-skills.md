---
title: "The observability wave: traces, evals, and ten new utility skills"
date: 2026-08-16
author: "Agenthood Team"
summary: "From redacted trace envelopes to anomaly alerts and Sentry reporting, Agenthood can now explain itself — and the Society welcomes ten new utility skills."
---

# The observability wave: traces, evals, and ten new utility skills

**Date:** August 16, 2026
**Author:** Agenthood Team

In the last 48 hours the upstream repository shipped ten releases — v3.28.0 through v3.35.0 — that did two very different things. The first is an observability wave that lets Agenthood explain what it did, how much it cost, and when something is going wrong. The second is a quiet expansion of the Society itself: ten utility skills ported from the GitHub Copilot library and deepagents, covering everything from bug fixes to onboarding plans.

If you only read one section, read the first one — traces went from an internal detail to a first-class, inspectable, redacted record.

## The trace pipeline is now production-grade

Agenthood has always kept records of what its members do, but those records lived mostly in memory and logs. That changed across the last three days:

- **Redaction, by default.** Since v3.28.0, trace payloads pass through a configurable redaction filter, and v3.34.0 made redaction fail closed — if the filter cannot determine whether a field is sensitive, the field does not ship. Decision and provenance payloads are redacted too, with envelope hashing aligned across all of them.
- **Retention and export.** v3.29.0 added a retention policy to the trace store, so `~/.agenthood` never grows without bound and traces can be exported when you need them.
- **Anomaly detection.** The same release added anomaly detection for cost and quality signals, and v3.33.0 wired it into trace flush with alerts you can read via `npx agenthood status --alerts`.
- **Health and Sentry.** `agenthood health` (v3.31.0) checks tracer, store, registry, and providers with a meaningful exit code, and v3.32.0 made Sentry reporting optional and additive — no DSN, no noise.

The result is a closed loop: every member run emits a stamped, redacted envelope, costs and quality are measured per member, anomalies surface as alerts, and `agenthood eval --replay` (v3.33.0) can replay recorded runs against a current build to catch behavior drift.

## Runtime hardening in v3.34.0

The biggest single release in the window was mostly invisible: v3.34.0 closed trust-boundary escapes across the agent layer. Retrieved and project context is now delimited as untrusted data and escaped, `user_query` injection is closed with a shared wrapping helper, delegation is restricted to read-only roles, and ReAct loops are bounded by a `maxSteps` guard. If you run agents against untrusted repositories, this release is worth the upgrade by itself — the details are in the [v3.34.0 release notes](/releases/).

## The Society grows beyond members

v3.35.0 ported ten utility skills from the GitHub Copilot library and deepagents, all documented in the new [utility skills](/academy/utility-skills/) reference:

- **Fix and clean:** `bug-fix-teammate`, `cleanup-specialist`, `pull-request-assistant`
- **Plan and explain:** `implementation-planner`, `concept-explainer`, `issue-manager`, `onboarding-plan`
- **Teach and audit:** `debugging-tutor`, `accessibility-auditor`
- **Remember:** `remember`, ported from deepagents

Unlike the nineteen Society members, these are utility skills: single-purpose, drop-in files that cover workflows the members do not own. Copilot review, README, API-doc, and unit-test patterns were also merged into existing members so the canonical skill files stay aligned with the wider ecosystem.

## What this means for the Studio

This site's playground runs the same runtime through `agenthood/dist/llm` — every chat request now goes through the same redacted trace pipeline, which is exactly the behavior [documented in the Studio architecture](/docs/governance/). The trace envelopes this site emits with `source: "playground"` follow the same shape as the upstream runtime, so playground activity is comparable with member runs in the CLI.

If you are new to the observability pieces, the [decision-intelligence architecture doc](/docs/architecture/decision-intelligence/) and the recent ADRs — [ADR-017 (embedding index)](/adr/ADR-017-embedding-index-semantic-learning/), [ADR-018 (redaction scope)](/adr/ADR-018-redaction-scope-for-decisions/), and [ADR-019 (executor contract)](/adr/ADR-019-executor-contract-model-attribution/) — are the best starting points.
