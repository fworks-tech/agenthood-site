# Contributing to Agenthood

Thank you for your interest in contributing! This document outlines the standards and workflows for this repository.

## Code of Conduct

Be respectful, constructive, and professional. Harassment or exclusionary behavior will not be tolerated.

## How to contribute

### Reporting bugs

1. Check if the issue already exists
2. Open a new issue with:
   - A clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Your environment (browser, OS, Node version)

### Suggesting features

Open an issue describing the feature, why it's valuable, and how it might be implemented.

### Pull requests

1. Fork and clone the repository
2. Create a branch: `type/issue-NUMBER-short-description`
3. Make your changes
4. Run tests: `npm test` and `npm run test:e2e`
5. Run lint: `npm run lint`
6. Commit following [Conventional Commits](https://www.conventionalcommits.org/)
7. Open a PR linked to an issue via `Closes #N` or `Fixes #N`

## Commit standards

- Follow [Conventional Commits](https://www.conventionalcommits.org/) strictly
- Format: `type(scope)!: subject` — `!` marks breaking changes
- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `chore`, `revert`
- Subject: imperative, lowercase, <=150 chars, no trailing period
- One logical change per commit

## Branch standards

- One branch per issue: `type/issue-NUMBER-short-description`
- Never commit directly to `main`
- Branch names are lowercase, hyphenated, no spaces

## Important note about `content/`

Files under `content/` are auto-generated from the upstream `fworks-tech/agenthood` repo by sync scripts. **Do not edit them directly.** To change content:

- For docs, ADRs, academy: edit the upstream repo
- For sync behavior: edit `scripts/sync-docs.mjs` or `scripts/sync-skills.mjs`
- For news: `content/news/` is tracked and human- or agent-written

## Local development

```bash
npm install
npm run dev
```

The `predev` script syncs content from upstream automatically. Requires network access to `raw.githubusercontent.com`.

## Testing

```bash
npm test          # unit tests (Vitest)
npm run test:e2e  # end-to-end tests (Playwright)
```

All tests must pass before a PR can be merged.

## PR review

Every PR requires review. The reviewer checks:

- Correctness, readability, architecture, security, and performance
- Test coverage for new behavior
- Adherence to commit and branch standards

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
