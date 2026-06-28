# agenthood-site

> The marketing site for [Agenthood](https://github.com/fworks-tech/agenthood) — a society of AI agents with impeccable standards and zero tolerance for `fix stuff` commits.

Live at **[agenthood.flabs.tech](https://agenthood.flabs.tech)**

---

## What's here

This is the public-facing landing site for the Agenthood project. It presents the 16 specialized AI agent members, explains how the society works, and links to the GitHub repository and the Academy.

| Route | Content |
|-------|---------|
| `/` | Landing page — agents, how it works, GitHub link |
| `/academy/` | Academy — educational articles (proxied from GitHub Pages) |

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Deployment | Vercel |

---

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Related repositories

| Repo | Purpose |
|------|---------|
| [fworks-tech/agenthood](https://github.com/fworks-tech/agenthood) | The Society — 16 agent skill files, TypeScript runtime, CI workflows |
| [fworks-tech/flabs.tech](https://github.com/fworks-tech/flabs.tech) | Personal portfolio of the author |

---

## Architecture notes

- The `/academy/` route is a Vercel rewrite that proxies to `fworks-tech.github.io/agenthood/` (MkDocs Material, deployed via GitHub Actions on the main repo).
- MkDocs assets are also proxied via `/assets/:path*` to avoid broken styles.

---

*The Society is open to all who take the oath seriously. Membership is free. Standards are not.*
