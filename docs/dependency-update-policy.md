# Dependency Update Policy

## Automated Patch Updates

Dependabot opens PRs weekly (Monday 09:00) for npm and monthly for GitHub Actions. Patch updates that pass CI are **auto-merged** by the `dependabot-auto-merge` workflow.

## Minor Updates

Dependabot opens grouped minor update PRs. These require **manual review** — check the diff, verify CI passes, and confirm no breaking changes before merging.

## Major Updates

Major version bumps require **full regression testing**:

1. Review upstream changelog for breaking changes
2. Run full local gate: `npm run lint && npm run typecheck && npm run build && npm test`
3. Run e2e tests: `npm run test:e2e`
4. Verify the staging deployment (once #47 is resolved)
5. Assign a reviewer who owns the affected subsystem

### Known Blocked Major Upgrades

| Package | Target | Blocker |
|---------|--------|---------|
| typescript | 7.x | `@typescript-eslint@9` not yet released (peer requires `<6.1.0`) |
| eslint | 10.x | `eslint-config-next@17` not yet released (uses removed `contextOrFilename.getFilename()`) |

These will unblock when their respective ecosystems catch up. Subscribe to the upstream repos for release notifications.

## Manual Dependency Changes

For dependencies not managed by Dependabot (e.g., `agenthood`, which is exact-pinned and blocked by its own exports map changes), upgrades are applied manually per the relevant issue. See `content/release-notes.md` for the upgrade log.
