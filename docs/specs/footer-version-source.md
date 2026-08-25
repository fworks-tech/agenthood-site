# Spec: Footer version badge derives from a single source of truth

## Problem

`app/components/Footer.tsx` fetches `https://registry.npmjs.org/agenthood/latest` at runtime,
falls back to hardcoded `3.36.0` literals (also duplicated in `e2e/footer.spec.ts` and
`README.md`), and labels the result "the currently installed version". The literals drifted
once (`3.35.0` → `3.36.0`, caught only in review) and the badge's `latest` semantics disagree
with its `installed` label.

## Proposed Solution

Represent the **installed** version from a single build-time source:

1. `app/_lib/agenthood-version.ts` exports `AGENTHOOD_VERSION` read from the installed
   `agenthood/package.json`.
2. The server layout `app/(main)/layout.tsx` passes it to the Footer as a prop.
3. Footer drops the fetch, the loading state, and every literal; the badge renders `v{version}`.
4. `https://registry.npmjs.org` is removed from `connect-src` in `next.config.ts`.
5. README and the HelpTip reference the same constant; HelpTip continues to say "installed".

## Out of Scope

- Displaying npm `latest` (a "newest release" badge would be a separate feature).
- Proxying the npm registry through a first-party route.
- Editing generated `content/` release notes (owned by the upstream repo).

## Acceptance Criteria

- [ ] Badge renders the installed version from `AGENTHOOD_VERSION`; no literal in Footer
- [ ] README pin note routes to the same constant
- [ ] HelpTip and badge both present the "installed" semantics
- [ ] `registry.npmjs.org` absent from `connect-src`
- [ ] `e2e/footer.spec.ts` asserts the dynamic installed version and that a blocked registry
      request does not affect the badge
- [ ] Lint, unit tests, and `npx playwright test e2e/footer.spec.ts` pass

## Testing Strategy

- **Unit:** none needed for the constant itself (pure build-time value); the
  `agenthood/package.json` resolution is covered by `e2e/footer.spec.ts`.
- **E2E:** assert the badge equals `v${AGENTHOOD_VERSION}` on `/`; block the npm registry route
  and assert the badge is unaffected (proves no runtime fetch dependency).
- **Build:** `next build` must succeed with the new JSON import in a server module.

## Open Questions

None — ADR-007 records the `installed` over `latest` decision.