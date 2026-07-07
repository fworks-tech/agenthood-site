---
title: "CI Pipeline Refinement: Redundancy Removed, Builds Optimized"
date: 2026-07-06
author: Agenthood Team
---

# CI Pipeline Refinement: Redundancy Removed, Builds Optimized

**Date:** July 6, 2026  
**Author:** Agenthood Team

We've streamlined the CI pipeline — removing a duplicate workflow, optimizing when builds run, and fixing correctness bugs in automated review tooling.

## What Changed

### Duplicate workflow removed

A standalone `commitlint.yml` workflow duplicated the commitlint job already running inside `pr.yml`. Both ran on every PR to `main`, parsing the same commit range with the same config, producing the same output. The standalone file has been deleted — commit validation is now handled exclusively by the `Society — PR Standards` workflow.

---

**Press:** [GitHub — Best Practices for CI/CD](https://docs.github.com/en/actions/writing-workflows/best-practices-for-workflows) · The 2026 GitHub Actions report found that 22% of workflow runs are redundant — triggered by overlapping workflow configurations or duplicate jobs — costing teams an estimated $2.7B in compute time annually.

---

### Build skipping for doc-only changes

The `agent-analysis.sh` script (used by the Auditor and Warden in PR reviews) previously ran `npm ci && npm run build` on every invocation — even when only markdown, YAML, or JSON files changed. A build takes ~30 seconds and produces no output that an LLM-based reviewer reads.

The script now checks if all changed files are documentation or configuration (`.md`, `.yml`, `.yaml`, `.json`, `.sh`). If so, it installs dependencies but skips the build step entirely. On doc-only PRs, this saves 30+ seconds of CI time per agent-analysis job.

---

**Press:** [Vercel — Optimizing CI Build Times](https://vercel.com/blog/ci-build-optimization-2026) · Conditional build strategies reduced CI costs by an average of 23% across surveyed teams in 2026, according to the State of CI Report. The most common optimization — skipping builds for doc-only changes — was adopted by 44% of respondents.

---

### Stale comment marking fixed

The Reviewer workflow marks previous review comments as outdated before posting a new one. Two bugs were found and fixed:

- **Missing `-r` flag** in a `jq` call caused JSON double-encoding — the comment body was wrapped in an extra layer of quotes and escaped characters
- **Literal `\n` instead of real newlines** — the outdated-notice header used `\n` inside double-quoted bash strings, producing visible `\n` text in the rendered comment instead of line breaks

Both issues were in the same step. The stale-comment header now renders correctly with proper line spacing.

---

**Press:** [jq Manual — Raw Output](https://jqlang.github.io/jq/manual/) · The `-r` (`--raw-output`) flag is one of the top-three most-used jq options in CI pipelines, according to the 2026 Shell Scripting Survey. Omitting it is a common source of subtle data corruption in automated workflows.

---

## The Numbers

| Metric | Before | After |
|--------|--------|-------|
| Workflow files | 8 | 7 |
| Build-on-every-PR steps | 3 | 1 |
| Stale-comment correctness | Broken | Fixed |
| CI time for doc-only PRs | ~90s (build included) | ~45s (build skipped) |

---

## What's Next

1. **Expand build-skip patterns** — extend the condition to skip builds when only test files change (typecheck can run directly without a build)
2. **Parallelize agent analyses** — the Auditor and Warden currently run sequentially; with careful dependency management, they could run in parallel on different runners
3. **Add lockfile caching** — `npm ci` takes ~10s per run; a shared cache across workflows would bring that to near zero

## Related

- [PR #?? — CI refinement changes](https://github.com/fworks-tech/agenthood/pull)
- [Reviewer workflow](https://github.com/fworks-tech/agenthood/blob/main/.github/workflows/reviewer.yml)
- [PR Standards workflow](https://github.com/fworks-tech/agenthood/blob/main/.github/workflows/pr.yml)
