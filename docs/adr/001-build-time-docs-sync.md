# ADR-001: Build-time synchronization for documentation

**Date:** 2026-06-25
**Status:** Accepted

## Context
The Agenthood site must render documentation that lives in a separate repository (`fworks-tech/agenthood`). We need a mechanism that keeps the docs current, performs well, and fits the site design.

## Decision
Use a Node.js sync script that runs during `prebuild` and `predev` to fetch raw Markdown and directory manifests from the `main` branch into a generated `content/` directory. Next.js then renders these as static pages at build time.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Runtime fetch on every request | Always shows latest source | Request latency, runtime dependency on GitHub, caching/SEO issues | Slower and less reliable than static pages |
| Proxy `gh-pages` branch | No local content to maintain | Output is standalone HTML that cannot share the site navbar or theme | Cannot meet the design/integration requirement |
| Build-time sync | Fast static pages, themeable, SEO-friendly, decouples deploy from source updates | Requires rebuild to update docs, needs a sync script | Best fit for the requirement |

## Consequences
- Documentation updates only when the site is rebuilt.
- Vercel builds must run the `prebuild` script.
- `content/` is gitignored and generated per environment.
- Raw GitHub API rate limits apply during sync; can be mitigated with a `GITHUB_TOKEN` if needed.

## References
- Existing `app/releases/page.tsx` previously fetched release notes at runtime.
- GitHub tree and raw content APIs.
