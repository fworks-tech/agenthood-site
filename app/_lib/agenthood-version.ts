import appPkg from "../../package.json";

/**
 * The single source of truth for the "currently installed" Agenthood version.
 * Derived from the exact dependency pin (no `exports`-gated subpath) rather than
 * a hand-maintained literal. The Footer badge and the README pin both read from
 * this constant, so they cannot drift apart.
 *
 * agenthood 3.56 added an `exports` map that no longer exposes `./package.json`,
 * so the previous `import { version } from "agenthood/package.json"` (ADR-007)
 * no longer resolves. This app pins agenthood to an exact version, so the
 * declared dependency IS the installed version — reading it from this app's own
 * manifest bundles cleanly with no runtime `fs` and no `node_modules` reach.
 */
export const AGENTHOOD_VERSION: string = appPkg.dependencies.agenthood;
