# ADR-013: MCP remote-only on Vercel

**Date:** 2026-11-26
**Status:** Accepted (first server wired: `docs`, readOnly — see below)

## Context

Agenthood 4.5.0 adds an MCP client (`mcpServers` in `.agenthood/config.json`,
`mcp.<server>.<tool>` in `allowed-tools`, `mcp__<server>__<tool>` at runtime).
Vercel serverless has read-only `/var/task` and no process spawn. The public
`/api/studio/*` routes also carry paid-LLM cost per call.

## Decision

- MCP transport policy: **remote HTTP only** on Vercel. Stdio servers are
  explicitly unsupported and fail closed.
- Enforcement (all three layers reject `mcp__*` today):
  - `app/(main)/studio/_lib/tools.ts` — `isMcpToolName` + `executeTool`
    returns a not-configured error;
  - `app/api/studio/tools/execute/route.ts` — explicit MCP branch with
    `ValidationError` before the generic unknown-tool error;
  - `app/api/studio/chat/route.ts` — `validateConfig` throws on `mcp__*`
    instead of silently dropping it.
- `getMemberTools` never emits `mcp__*`, so `restricted` members get none by
  construction. `mcpServers` lives only in `.agenthood/config.json`
  (host-declared); a `SKILL.md` `mcpServers` key is ignored. Secrets only via
  env-substituted headers.
- Trace/observability for MCP (server/grant/invocation fields) is deferred to
  the first real remote-server PR — no dead wire surface until then.

## First server: `docs` (readOnly)

- Declared in `.agenthood/config.json` `mcpServers.docs` (transport http,
  `${env:MCP_DOCS_URL}`, bearer `${env:MCP_DOCS_AUTH_TOKEN}`, `readOnly`).
  Unset URL or token fails the server closed — never half-configured.
- Grant: `isMcpToolAllowedForMember` (declared ∩ https ∩ known member). No
  `restricted` lane exists in the Studio; any registered member may use the
  readOnly server, matching the `web_fetch` lane.
- Execution is server-side (`tools/call` + `tools/list`, `redirect: 'error'`,
  15s timeout, 6k-char bound), so no `connect-src` CSP change is needed —
  the browser never talks to the MCP host. Schemas come from `tools/list`,
  filtered to exactly the enabled names; args/results are never logged
  (names + outcome only).

## Consequences

- Easier: Studio cannot hang the 30-60s function budget spawning stdio.
- Harder: first remote MCP server still needs `connect-src` CSP + tracing
  allowlist per host.
- Risk: the grant rule (`declared ∩ allowlist`) is hand-rolled, not shared
  with `MemberAgent`/`McpSession` — do not expose stdio or `restricted` MCP
  until shared.

## References

- `app/(main)/studio/_lib/tools.ts`, `app/(main)/studio/_types/studio.ts`,
  `app/api/studio/tools/execute/route.ts`, `app/api/studio/chat/route.ts`,
  `.agenthood/config.json`, ADR-005.
