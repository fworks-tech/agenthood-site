import { version } from "agenthood/package.json";

/**
 * The single source of truth for the "currently installed" Agenthood version.
 * Derived from the installed package (no `exports` field, so the subpath JSON
 * is resolvable) rather than a hand-maintained literal. The Footer badge and
 * the README pin both read from this constant, so they cannot drift apart.
 */
export const AGENTHOOD_VERSION = version;
