# ADR-007: Footer badge shows the installed (pinned) Agenthood version

**Date:** 2026-08-25
**Status:** Accepted

## Context

The Footer version badge fetched `https://registry.npmjs.org/agenthood/latest` at runtime and
fell back to a hand-maintained literal on failure, while its HelpTip claimed "the currently
installed version of Agenthood". Three hardcoded `3.36.0` literals (the fetch fallback in
`app/components/Footer.tsx`, the render fallback, and `e2e/footer.spec.ts`) drifted from `3.35.0`
when the dependency bumped in #131, and were only caught by review. Two semantics were mixed:

- **`latest`** — what npm says the newest release is (can outpace the pinned install).
- **`installed`** — the exact `agenthood@X.Y.Z` this site builds and runs against.

## Decision

The badge represents the **installed** version, derived once at build time from the installed
package and propagated as a prop to the client Footer:

- `app/_lib/agenthood-version.ts` exports `AGENTHOOD_VERSION = version` from
  `agenthood/package.json` (the package has no `exports` field, so the subpath JSON is
  resolvable; `resolveJsonModule` is enabled).
- The server layout `app/(main)/layout.tsx` passes it to `<Footer version={...} />`.
- The runtime npm fetch, the loading state, and all hardcoded literals are removed.
- `https://registry.npmjs.org` is dropped from `connect-src` CSP in `next.config.ts`.
- README and the Footer HelpTip route to the same constant (no literal to maintain).

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Keep fetching `latest` from npm | Shows newest release | Literal fallback reintroduces drift; label claims "installed" but shows `latest`; CSP egress to a third-party origin | Behavior and label disagreed; the drift class of bug persists |
| Fetch `latest`, fallback to `AGENTHOOD_VERSION` | Fallback correct by construction | Still shows `latest` while HelpTip says installed; keeps registry egress | Confused semantics remain — the issue is the label, not just the fallback |
| Read version from the Site's own `package.json` dependency pin | No cross-package read | Harder to keep in sync if the pin form changes (range vs exact); "installed" truth lives in the package itself | The installed package is the truthful source; a second derivation risks the same drift |

## Consequences

- **Easier:** one constant rules badge + README; no runtime fetch, no registry CSP egress, no
  loading state; a dependency bump automatically moves the badge.
- **Harder:** the badge no longer advertises the newest npm release — it intentionally reflects
  the pinned runtime, matching the HelpTip and the site's deployment reality.
- **Risk:** if the site later wants to show `latest`, that is a deliberate change to both the
  constant's semantics and this ADR (see References).

## References

- Issue fworks-tech/agenthood-site#135; PR #134 (origin of the review notes);
  `app/_lib/agenthood-version.ts`, `app/components/Footer.tsx`, `app/(main)/layout.tsx`,
  `next.config.ts`, `e2e/footer.spec.ts`.