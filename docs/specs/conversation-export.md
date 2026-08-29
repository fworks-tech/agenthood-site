# Spec: Conversation export (JSON / Markdown)

## Problem

Conversations live only in `localStorage["agenthood-studio-conversations"]`. Users have no way
to save, back up, or share a chat transcript outside the browser.

## Proposed Solution

- `app/(main)/studio/_lib/export-conversation.ts`:
  - `serializeConversationJson` — a versioned envelope
    (`{ format: "agenthood-conversation", version: 1, exportedAt, conversation }`) containing the
    full conversation: id, agentId, title, timestamps, tokenCount, redacted config, and messages
    with their `toolCalls` (args, result, error, status).
  - `serializeConversationMarkdown` — a readable transcript: title, agent, provider·model,
    exported date, token count, then per message a `## User` / `## Assistant` block with tool
    call details (args as JSON, result, error).
  - `conversationFilename` / `downloadBlob` — safe filenames and browser download helper.
- **Security:** the exported `config` is an allow-list of portable, non-secret fields
  (`provider`, `model`, `temperature`, `maxTokens`, `systemPrompt`, `enabledTools`). `apiKey`
  and `baseUrl` (which can embed credentials) are withheld entirely — never written, even
  scrubbed, since a scrubbed token still leaks that a key existed. Unknown future config
  fields are excluded by default rather than scrubbed one field at a time.
- **UI:** an Export menu in the playground header (JSON / Markdown), visible only when the active
  conversation has messages; reaches the full active conversation from the in-memory store.

## Out of Scope

- Exporting LiveLogs / network traces.
- Import or restore of exported files (round-trip).
- Server-side conversation storage.

## Acceptance Criteria

- [ ] JSON export is valid, versioned, contains full messages + toolCalls + allow-listed config;
      `apiKey`/`baseUrl` withheld
- [ ] Markdown export is a readable transcript with per-message roles and tool details; no
      `apiKey`
- [ ] Export menu visible in the header only when the conversation has messages
- [ ] Downloads named `agenthood-conversation-<slug>.{json,md}`
- [ ] Unit tests cover serialization, redaction, missing tool calls, empty/untitled titles
- [ ] E2E downloads both formats and validates content
- [ ] Lint, unit tests, and `e2e/export.spec.ts` pass

## Testing Strategy

- **Unit** (`__tests__/export.test.ts`): pure serializers — envelope shape, redaction,
  tool-call inclusion, no-tools messages, filename slugging.
- **E2E** (`e2e/export.spec.ts`): mock chat → send → trigger `download` events for JSON and
  Markdown → read the downloaded files and assert content; assert menu hiding before messages.

## Open Questions

None.