---
title: "Studio Tools: Web Fetch & Code Execution in the Playground"
date: 2026-07-07
author: Agenthood Team
---

# Studio Tools: Web Fetch & Code Execution in the Playground

**Date:** July 7, 2026  
**Author:** Agenthood Team  
**PR:** [#40 — feat(studio): add tools support (web fetch + code execution) to playground](https://github.com/fworks-tech/agenthood-site/pull/40)

Agents in the Studio playground can now use tools during chat. Two tools are available in the initial release: `web_fetch` for retrieving content from the web, and `code_execution` for running JavaScript in a sandboxed environment.

## How It Works

The tool execution loop runs server-side in the agenthood adapter:

1. The LLM generates a response with tool call requests
2. The server executes the requested tool with the provided arguments
3. Results are fed back into the conversation context
4. The LLM produces the final text incorporating tool output

This loop is transparent to the user — tool calls and results are rendered as inline indicators in the chat UI (green checkmark for success, red X for failure, spinner during execution).

## Tools

| Tool | What it does | Security |
|------|-------------|----------|
| **web_fetch** | Fetches content from a URL and returns the text (HTML stripped) | Allowed hosts: `github.com`, `raw.githubusercontent.com`, `gist.github.com` only. 15s timeout, 100KB limit. |
| **code_execution** | Runs JavaScript code in a sandbox | `node:vm` sandbox with 5s timeout. No filesystem or network access. |

## Configuration

Each conversation can enable or disable tools individually. The Tools & Capabilities section in the AgentConfigPanel provides checkboxes for each tool. When disabled, the LLM will not be offered that tool during chat.

## Files Changed

- **`app/(main)/studio/_lib/tools.ts`** — new file containing tool definitions, JSON schemas, and execution handlers
- **`agenthood-adapter.ts`** — server-side agentic loop with tool call/result streaming
- **`stream.ts`** — added `onToolCall` and `onToolResult` callbacks to NDJSON parser
- **`useStudioChat.ts`** — tool event handling and ToolCallInfo storage on messages
- **`MessageBubble.tsx`** — tool call indicators in the chat UI
- **`AgentConfigPanel.tsx`** — Tools & Capabilities configuration section
- **Types** — `enabledTools` field on ChatConfig, `ToolCallInfo` type

## What's Next

This initial release supports two tools with tight security boundaries. Future iterations may add:
- Additional tools (database queries, API calls to registered services)
- User-defined custom tools
- Tool execution history and replay
- Rate limits and quotas per tool

---

**Press:** [Agenthood Studio Tools — Developer Preview](https://github.com/fworks-tech/agenthood-site/pull/40) · 97 unit tests and 106 e2e tests pass. Closes issue [#39](https://github.com/fworks-tech/agenthood-site/issues/39).
