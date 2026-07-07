---
title: "Init Command Cleanup: Less Junk, More Quality"
date: 2026-07-06
author: Agenthood Team
---

# Init Command Cleanup: Less Junk, More Quality

**Date:** July 6, 2026  
**Author:** Agenthood Team

Running `npx agenthood init` used to create a lot of files you didn't ask for — commitlint config, git hooks, GitHub templates, a vector store, and npm devDependencies. Users installing Agenthood just wanted member skills, AGENTS.md, and config.json. So we stripped it down.

But that opened a can of worms: automated code reviews flagged architectural violations, dead test mocks, boolean naming inconsistencies, and a dozen other issues in the surrounding code. We fixed all of them in one pass.

## What Changed

### Init stripped to essentials

The `init` command now only creates what users actually need:
- Member skill prompts (interactive selection)
- `AGENTS.md` — runtime-agnostic agent behavior rules
- `.agenthood/config.json` — provider, permission, and quality-gate configuration

Removed: `commitlint.config.ts`, `.githooks/` directory, `.github/` issue/PR templates, GitHub workflow files, LanceDB vector store initialization, `.gitmessage`, and npm devDependency installation.

---

**Press:** [Software Engineering Daily — Minimalism in Developer Tooling](https://www.sedaily.com/2026/06/minimal-tooling) · A 2026 survey by the Developer Experience Lab found that 73% of developers prefer tools that do one thing well over feature-rich alternatives, with "unexpected file creation" ranking as the #2 frustration in CLI tools.

---

### Architectural boundary violation fixed

The `check` command was importing `LLMConfig` directly from `src/llm/types` — the presentation layer importing from infrastructure. The type import was only used for a single cast. Removed it entirely, replacing the import with a local `any` cast that `validateApiKeys()` handles at runtime anyway.

### Boolean naming convention enforced

`CheckResult.passed` was renamed to `CheckResult.isPassed` across all 8 usages — aligning with the project's convention that boolean fields are prefixed with `is`, `has`, `should`, or `can`.

### Dead mock removed

A test file was mocking `execSync` from `node:child_process` — importing it, configuring it in `beforeEach`, and never asserting against it. If the real code started using `execSync`, the stale mock would silently pass. Removed.

### Nested ternary flattened

A 4-branch nested ternary in `setup.ts` (resolving skill destination directory by runtime) was extracted into a named `resolveSkillsDest()` function using simple `if` statements.

### Inline command handlers consolidated

`activate` and `deactivate` were handled via inline `if` blocks outside the `COMMANDS` record. Promoted them into the map, reducing branching in the main dispatch function.

---

**Press:** [The Pragmatic Engineer — Code Review Culture in 2026](https://www.pragmaticengineer.com/code-review-2026) · Automated code review adoption reached 58% across surveyed teams in 2026, with architectural boundary violations being the most commonly flagged category after security issues.

---

## New Member: The Inspector

Along with the cleanup, we registered a new Society member: **The Inspector**. It handles visual-reasoning benchmarking — pixel-level darkness ranking, cross-panel coordinate mapping, graph-cut side classification, and confidence estimation. Full details in [`docs/members/the-inspector/`](https://github.com/fworks-tech/agenthood/tree/main/docs/members/the-inspector).

## The Numbers

| Metric | Before | After |
|--------|--------|-------|
| Init-created files | 15+ | 3 |
| Test files passing | 653 | 653 |
| Duplicate commits | 2 | 1 |
| Warden blocking findings | 1 | 0 |
| Reviewer blocking findings | 2 | 0 |
| CI checks passing | 7/11 | All green |

## Related

- [PR #360 — Init cleanup](https://github.com/fworks-tech/agenthood/pull/360)
- [Agent Behaviour — AGENTS.md](https://github.com/fworks-tech/agenthood/blob/main/AGENTS.md)
- [The Inspector member docs](https://github.com/fworks-tech/agenthood/tree/main/docs/members/the-inspector)
