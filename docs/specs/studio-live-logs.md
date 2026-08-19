# Spec: Studio Live Logs Observability

## Problem

The LiveLogs panel in the Studio playground is a closed circuit. It shows coarse client
events (agent load, send, config) but hides: the CAPTCHA success path, network status codes,
server correlation IDs, and anything older than the page load. When something goes wrong (for
example the Turnstile timeout fixed in issue #89), users see a symptom line but no lifecycle,
no request ID to correlate with Vercel Logs, and no way to capture/export the trail.

## Proposed Solution

Upgrade the log model, capture the missing telemetry, and enrich the UI. The work is split
into four concerns (one branch each) so each change is independently reviewable and revertible.

1. **Log model** — `LogLevel` gains `debug`; entries carry a `category`, stable `id`, epoch
   `ts`, and optional `detail`. A small store (`_lib/log-store.ts`) caps at 200 entries and
   persists to `sessionStorage`, restored on mount. `addLog` in the playground accepts
   `{ category?, detail? }` meta. (Issue #90)

2. **CAPTCHA telemetry** — `Turnstile.tsx` gains an optional `onStatus` callback emitting
   lifecycle phases (`script-loading`, `script-loaded`, `widget-rendered`, `challenge-required`,
   `token-received`, `token-expired`, `retrying`), plus existing errors. The playground logs
   each phase under `category: "captcha"`, and logs `CAPTCHA ready` on **every** token
   acquisition (not only the first). (Issue #91)

3. **Network telemetry via SSE `log` events** — the server adapter duplicates its structured
   log sites into the SSE stream as `{type:"log"}` events (client-safe meta allowlist only);
   `stream.ts` parses them into an optional `onLog` callback; `useStudioChat` forwards through
   an `onLog` option; the playground routes them to LiveLogs under `category: "network"` with
   the correlation id in `detail`. HTTP status for pre-stream failures still comes from the
   response. (Issue #92)

4. **LiveLogs UI** — a "Copy logs" button, auto-expand of the panel when an `error` entry
   arrives while collapsed, a debug toggle (hide/show `debug`), and a category filter. (Issue #93)

## Out of Scope

- Full server→client *streaming of arbitrary server logs* beyond the fixed SSE `log` event shape.
- Log download as `.json`/`.txt` (clipboard copy covers capture).
- Server-side log persistence changes (Vercel Logs remains the durable sink).
- Backfilling historical logs from before this release.

## Acceptance Criteria

- [ ] Chat works unchanged; every existing log surfaces with a category.
- [ ] After a page refresh, the prior session's logs are restored (capped at 200).
- [ ] CAPTCHA lifecycle shows `script-loaded → widget-rendered → token-received → CAPTCHA ready`
      on success, and timeout/error paths with retry indication.
- [ ] Each send/failure log carries HTTP status (pre-stream), and server `log` events surface
      routing/duration/token-count details with the correlation id.
- [ ] Clipboard copy returns timestamped, level/category-prefixed lines.
- [ ] An arriving error auto-expands a collapsed panel; debug entries are hidden by default.
- [ ] Existing unit tests pass; new `log-store`, adapter, and e2e tests pass.

## Testing Strategy

- **Unit (Vitest):** `_lib/log-store` add/slice/persist/restore; `LogEntry` shape; Turnstile
  `onStatus` ordering (mocked `window.turnstile`); adapter emits sanitized `log` events with no
  content/api-key leak; stream parser routes `log` events.
- **E2E (Playwright):** debug toggle, auto-expand-on-error, copy button, category filter, and a
  server `log` event appearing in LiveLogs.
- **Command:** `npm test`, `npm run lint`, `npm run test:e2e`.

## Open Questions

- Whether `challenge-required` should also force-render the widget visibly — the widget is
  already visible bottom-right after issue #89, so no further change is needed for now.
- Full arbitrary server-log streaming — deferred to a future ADR if Vercel Logs proves
  insufficient as the durable sink.

## References

- Issues fworks-tech/agenthood-site#90–#93; ADR-003 (trace emission), ADR-004 (log model + SSE telemetry)
