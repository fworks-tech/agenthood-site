# ADR-013: MCP remote-only on Vercel + 4h CAPTCHA cookie

**Date:** 2026-11-26
**Status:** Accepted
**Supersedes:** ADR-010 (cookie TTL 24h → 4h)

## Context

Agenthood 4.5.0 adds an MCP client (`mcpServers` in `.agenthood/config.json`,
`mcp.<server>.<tool>` in `allowed-tools`, `mcp__<server>__<tool>` at runtime).
Vercel serverless has read-only `/var/task` and no process spawn. The public
`/api/studio/*` routes also carry paid-LLM cost per call.

## Decision

- MCP transport policy: **remote HTTP only** on Vercel. Stdio servers are
  explicitly unsupported and fail closed (`executeTool` rejects `mcp__*` until
  a host-allowlisted remote exists, `tools/execute` allowlist rejects unknown
  tools, `getMcpToolsForMember()` returns `[]`).
- `mcpServers` lives only in `.agenthood/config.json` (host-declared). `SKILL.md`
  `mcpServers` is ignored. Secrets only via env-substituted headers. No
  `mcp__*` grant for `restricted` members.
- Trace envelope carries `mcpServers/mcpGrants` (names + outcome only, no
  args/results by default).
- CAPTCHA cookie `CAPTCHA_COOKIE_MAX_AGE` 86400 → 14400 (4h). One solve no
  longer buys 24h of paid-LLM access. Re-solve required for paid hops stays
  as follow-up.

## Consequences

- Easier: Studio cannot hang the 30-60s function budget spawning stdio.
- Harder: first remote MCP server still needs `connect-src` CSP + tracing
  allowlist per host.
- Risk: grant logic is hand-rolled (`declared ∩ allowlist`), not shared with
  `MemberAgent/McpSession` — do not expose stdio or `restricted` MCP until
  shared.

## References

- `app/(main)/studio/_lib/tools.ts`, `app/(main)/studio/_types/studio.ts`,
  `app/(main)/studio/_lib/trace.ts`, `.agenthood/config.json`,
  `app/(main)/studio/_lib/captcha.ts`, ADR-005, ADR-010.
