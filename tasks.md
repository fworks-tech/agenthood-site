# Tasks: Render Agenthood docs from main branch inside the site

- [x] chore(deps): bump Next.js to a version compatible with App Router APIs.
- [x] feat(build): add `scripts/sync-docs.mjs` to fetch docs and generate manifests.
- [x] chore(build): wire `sync`, `prebuild`, and `predev` scripts in `package.json`.
- [x] chore(repo): gitignore the `content/` directory.
- [x] feat(ui): create shared `Navbar` component.
- [x] feat(ui): create shared `MarkdownRenderer` component with link rewriting.
- [x] refactor(ui): replace inline navbars on Home, Getting Started, and Releases with shared `Navbar`.
- [x] feat(releases): update `/releases` to render synced release notes from `main`.
- [x] feat(academy): add `/academy/[[...slug]]` catch-all page with static generation.
- [x] feat(adr): add `/adr/[[...slug]]` catch-all page with generated index.
- [x] chore(cleanup): remove `proxy.ts` and keep relevant `vercel.json` redirects.
- [x] test(verify): run sync, dev server, and production build; validate routes and links.
