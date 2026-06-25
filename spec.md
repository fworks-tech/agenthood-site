# Spec: Render Agenthood docs from main branch inside the site

## Problem
The Agenthood documentation (Academy, ADRs, Release notes) is published outside the marketing site, forcing visitors to leave the site and breaking the unified navigation/theme. The existing pages either do not match the site theme or fetch content at runtime.

## Proposed Solution
Introduce a build-time sync mechanism that pulls Markdown from the `main` branch of `fworks-tech/agenthood` into a generated `content/` directory. Provide shared `Navbar` and `MarkdownRenderer` components, then add App Router catch-all pages for `/academy/*` and `/adr/*`, and update `/releases` to render the synced release notes. All docs pages render with the site theme and shared navbar.

## Out of Scope
- Documentation search or full-text indexing.
- Versioned or branch-switching docs.
- CMS-style editing or preview workflow.
- Image assets in docs (none currently present; can be added later).
- Rewriting the Getting Started page content.
- Adding ADR to the top-level navbar (deferred; reachable via content links).

## Acceptance Criteria
- [x] `npm run sync` fetches `docs/academy/**`, `docs/adr/**`, and `docs/release-notes.md` from `main` and writes manifests.
- [x] `npm run build` runs the sync during `prebuild` and completes without errors.
- [x] `/academy/` renders `docs/academy/README.md`.
- [x] `/academy/<level>/` renders the level `README.md`.
- [x] `/academy/<level>/<article>/` renders the article Markdown.
- [x] `/adr/` renders an index listing all ADRs with titles.
- [x] `/adr/<adr-slug>/` renders the ADR Markdown.
- [x] `/releases` renders `docs/release-notes.md` from `main`.
- [x] Every docs page displays the shared `Navbar`.
- [x] Internal Markdown links resolve to site routes with trailing slashes.
- [x] `content/` is gitignored and not committed.

## Testing Strategy
- Manual: run the dev server, visit every route, click internal links, verify styling and navbar.
- Build verification: `next build` succeeds and produces static pages for all generated slugs.
- No automated test suite exists today; add tests if docs rendering logic grows beyond static generation.

## Open Questions
- Should ADR appear in the shared navbar? Deferred: it can be added later without changing routing.
