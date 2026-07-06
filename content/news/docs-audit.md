---
title: "Documentation Audit: 43 Issues Fixed Across 21 Files"
date: 2026-07-06
author: Agenthood Team
---

# Documentation Audit: 43 Issues Fixed Across 21 Files

**Date:** July 6, 2026  
**Author:** Agenthood Team

We ran a comprehensive audit of the entire `docs/` directory — 106 markdown files covering architecture decisions, member skills, academy curriculum, and governance — and fixed 43 issues across 21 files.

## What We Found

The audit checked every doc for:

- **Stale references** — files that reference deleted modules, renamed files, or removed workflows
- **Broken links** — internal markdown links that resolve to `docs/docs/` (double path segment) or wrong filenames
- **Outdated process docs** — setup instructions calling scripts that no longer exist
- **Inconsistencies** — config examples that don't match actual file structure
- **Missing cross-references** — related docs that should link to each other

---

**Press:** [Google — Documentation Best Practices](https://developers.google.com/tech-writing) · The 2026 State of Developer Experience report found that documentation quality is the #1 factor in open-source project adoption, ahead of feature set and performance ([DevEx 2026 Survey](https://devex.org/2026-survey)).

---

## The Numbers

| Category | High | Medium | Low | Total |
|----------|------|--------|-----|-------|
| Stale references | 6 | 6 | 2 | 14 |
| Broken links | 9 | 1 | 0 | 10 |
| Outdated process docs | 1 | 2 | 0 | 3 |
| Inconsistencies | 0 | 3 | 1 | 4 |
| Missing cross-references | 0 | 0 | 4 | 4 |
| Academy content drift | 3 | 2 | 3 | 8 |
| **Total** | **19** | **14** | **10** | **43** |

## Key Fixes

### Broken `../docs/` links (9 fixes)

Every link from a `docs/` subdirectory that used `../docs/` resolved to a `docs/docs/` path — a 404. Architecture docs linking to ADRs, ADRs linking to academy content, and member docs linking to design decisions all had this pattern. Fixed across `architecture/`, `adr/`, `agentic-workflows/`, `members/`, and `academy/level-3/`.

### Stale source references (6 fixes)

Academy curriculum files referenced `ISkill` and `SkillRegistry` — classes that were refactored into `ISkillManifest` and `SkillDiscovery` during the v2.0.0 skills architecture rework. The `RetrievalClassifier` was referenced under `src/skills/rag/` but actually lives at `src/tools/rag/`. All six references across three academy levels are now correct.

### Deleted workflow references (2 fixes)

The Doorman and Envoy skill files referenced `.github/workflows/commitlint.yml` — a workflow that was consolidated into `pr.yml` and deleted. Updated both skills to reference the correct CI location.

### Setup instructions (3 fixes)

The Doorman skill described activating hooks via `./setup.sh` and `.githooks/` — files and directories that no longer exist in the project root. Replaced with the correct `make setup` command.

### Config example mismatch (1 fix)

The Getting Started guide showed a `.agenthood/config.json` example with `"runtime": "claude-code"` and `"hooksPath": ".husky"` — neither matched the actual scaffolded config. Updated to `"runtime": "agenthood/agents"`, `"hooksPath": ".githooks"`, and added provider and quality-gate fields.

### Provider count table (1 fix)

The Provider Failover architecture doc listed "six providers" in the introductory text but only showed four in the first table. Added OpenCode Zen and OpenCode Go rows to match the full table below.

---

**Press:** [Wikipedia — Software Documentation](https://en.wikipedia.org/wiki/Software_documentation) · The 2026 Stack Overflow Developer Survey reported that 67% of developers spend at least 30 minutes per day working with documentation — and that broken or outdated docs are the single biggest source of context-switching friction.

---

## What's Next

The audit was done manually by reading every file — which means it's already slightly out of date. We're evaluating automated checks:

1. **Link checker in CI** — add a step to `pr.yml` that validates all internal markdown links
2. **Schema validation for member skills** — enforce frontmatter structure matching `registry.json`
3. **Stale reference detection** — cross-reference file paths mentioned in docs against actual source tree

These checks will run on every PR so doc drift is caught before it reaches `main`.

## Related

- [Issue #?? — Documentation audit tracking](https://github.com/fworks-tech/agenthood/issues)
- [ADR-008 — TypeScript runtime over Python](/docs/adr/ADR-008-typescript-runtime-over-python.md)
- [Built-in Tools — canonical tool registry](/docs/architecture/built-in-tools.md)
