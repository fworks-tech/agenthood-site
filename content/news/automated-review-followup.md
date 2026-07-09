---
title: "Automated Review Follow-Up: Warden & Auditor Catch What Humans Miss"
date: 2026-07-09
author: Agenthood Team
---

# Automated Review Follow-Up: Warden & Auditor Catch What Humans Miss

**Date:** July 9, 2026  
**Author:** Agenthood Team

After [PR #360](https://github.com/fworks-tech/agenthood/pull/360) — the init cleanup — was submitted, The Warden and The Auditor ran their automated reviews. They flagged issues that had nothing to do with the PR's scope: duplicated type definitions, silent error paths, test smell, and undocumented structures. We fixed three immediately and filed two issues for the remaining work.

This is the part of code review that humans are bad at: the structural violations hiding in plain sight, the error paths nobody exercised, the documentation gaps that metastasize. Automated agents don't get tired, don't scope-creep, and don't skip the boring parts.

## What Was Fixed

### Type duplication — 2 definitions of `Runtime`

The `src/llm/types.ts` file redefined a `Runtime` type that already existed in `src/members.ts`. Two definitions, slightly different, both in active use. The fix was straightforward: import from the canonical source, delete the duplicate. The Warden flagged this as an architectural boundary violation — the same concern belongs in one place.

### Silent error swallowing in `safeCopy`

The `safeCopy` utility in `init.ts` silently failed when the source file didn't exist — no log, no warning, no return value indicating failure. The Auditor marked this as a correctness issue. We added `console.warn` when the source is missing, making the failure visible in CI output without breaking the non-critical copy flow.

### Test smell — mock returning a function instead of a boolean

A test in the LLM provider suite mocked a health-check function to return an empty function `() => {}` instead of `false`. The test passed because the assertion only checked that the mock was called — it never checked the return value. The Warden flagged this as a brittle test pattern: the mock silently bypasses the contract. We changed it to return `false`, matching the real function's signature.

## What Was Filed

Two issues remain for follow-up work:

- **CLI auto-registration (#365)** — Commands are manually registered in the `COMMANDS` record instead of being auto-discovered. This creates a failure point every time a new command is added. The Warden flagged it as a maintenance smell.
- **Skills vs docs drift (#366)** — There's no automated check that member skill files in `skills/` are in sync with their canonical sources in `docs/members/`. The Auditor flagged this as a documentation integrity risk.

## The Process

The workflow is simple: automated review → fix → verify → repeat. After each fix, re-run The Warden and The Auditor to confirm the finding is resolved. If the fix introduces new issues (or misses the root cause), iterate. This is the same loop a human reviewer would follow, but automated agents can run it in seconds across thousands of lines.

## The Numbers

| Finding | Status |
|---------|--------|
| Duplicate `Runtime` type | Fixed |
| Silent error in `safeCopy` | Fixed |
| Test mock returning wrong type | Fixed |
| CLI auto-registration gap | Issue #365 |
| Skills/docs drift | Issue #366 |

## Related

- [The Warden member docs](https://github.com/fworks-tech/agenthood/tree/main/docs/members/the-warden)
- [The Auditor member docs](https://github.com/fworks-tech/agenthood/tree/main/docs/members/the-auditor)
- [PR #360 — Init cleanup](https://github.com/fworks-tech/agenthood/pull/360)
- [Issue #365 — CLI auto-registration](https://github.com/fworks-tech/agenthood/issues/365)
- [Issue #366 — Skills/docs drift](https://github.com/fworks-tech/agenthood/issues/366)
