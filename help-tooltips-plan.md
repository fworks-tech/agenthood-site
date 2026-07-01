# HelpTip Implementation Plan — Remaining Items

**PR #32** added the `HelpTip` component with 30+ tooltips across 8 files.  
**PR #34** (commit `2c73648`) completed the remaining **29 candidates** across all 5 phases.

---

## Status Legend

- ✅ **Done** (PR #32)
- ✅ **Done** (PR #34 — commit `2c73648`)

---

## The HelpTip Component

Already built in PR #32. Reusable `"use client"` component:

```tsx
<HelpTip text="Tooltip content" side="top|right|bottom|left" />
```

- **Desktop**: Hover shows dark tooltip (`bg-zinc-800 text-zinc-200`, max-w 280px)
- **Mobile**: Tap toggles tooltip visibility
- **Keyboard**: `focus-visible`, Escape dismisses

---

## Phase 1 — Studio Section Headers & Toggles

> 4 additions · 2 files · Very simple

### 1.1 "Agent Configuration" header

| Field | Value |
|-------|-------|
| **File** | `AgentConfigPanel.tsx:62` |
| **Element** | `<h2>` "Agent Configuration" |
| **Tooltip** | "Configuration panel for agent selection, provider, model, and safety limits." |

### 1.2 "Model & Behavior" header

| Field | Value |
|-------|-------|
| **File** | `AgentConfigPanel.tsx:155` |
| **Element** | `<h3>` "Model & Behavior" |
| **Tooltip** | "Controls which AI model powers the agent and how it generates responses." |

### 1.3 Config Panel collapse/expand toggle

| Field | Value |
|-------|-------|
| **File** | `AgentConfigPanel.tsx:66-78` |
| **Element** | Chevron `<button>` in panel header |
| **Tooltip** | "Collapses the config panel to give more space to the chat area." |

### 1.4 Playground header description

| Field | Value |
|-------|-------|
| **File** | `playground/page.tsx:222-224` |
| **Element** | `<p>` "Test agents, prompts, and controls in a live chat UI." |
| **Tooltip** | "A live chat environment for testing agent behaviors and configurations in real time." |

---

## Phase 2 — Studio Empty & Error States

> 9 additions · 5 files · Simple

### 2.1 "No conversations yet"

| Field | Value |
|-------|-------|
| **File** | `ConversationList.tsx:70` |
| **Element** | `<p>` "No conversations yet" |
| **Tooltip** | "Conversations appear here once you send a message to an agent." |

### 2.2 "No agents match your search."

| Field | Value |
|-------|-------|
| **File** | `AgentSidebar.tsx:63` |
| **Element** | `<p>` "No agents match your search." |
| **Tooltip** | "Try a different term. Agents can be found by name, role, or description." |

### 2.3 "Waiting for events..."

| Field | Value |
|-------|-------|
| **File** | `LiveLogs.tsx:69` |
| **Element** | `<p>` "Waiting for events..." |
| **Tooltip** | "Log entries appear here once you send a message or interact with an agent." |

### 2.4 "Failed to load agents" (desktop select)

| Field | Value |
|-------|-------|
| **File** | `AgentConfigPanel.tsx:104-105` |
| **Element** | `<option>` "Failed to load agents" |
| **Tooltip** | "The agent directory could not be fetched. Check your network connection." |

### 2.5 "Failed to load agents" (mobile)

| Field | Value |
|-------|-------|
| **File** | `playground/page.tsx:308-310` |
| **Element** | `<div>` "Failed to load agents" |
| **Tooltip** | "Could not load the agent list. Try again or check your connection." |

### 2.6 Playground welcome — "Select a Society member..."

| Field | Value |
|-------|-------|
| **File** | `playground/page.tsx:277-278` |
| **Element** | `<p>` "Select a Society member from the left panel to start testing..." |
| **Tooltip** | "Choose an agent from the sidebar or pick one from the dropdown below." |

### 2.7 Playground — "Start a conversation with..."

| Field | Value |
|-------|-------|
| **File** | `playground/page.tsx:267-268` |
| **Element** | `<p>` "Start a conversation with..." |
| **Tooltip** | "Type a message below to begin. Prompts are validated and rate-limited server-side." |

### 2.8 Loading agents spinner

| Field | Value |
|-------|-------|
| **File** | `playground/page.tsx:300-306` |
| **Element** | `<div>` "Loading agents..." with spinner |
| **Tooltip** | "Fetching the agent directory from the server. This should take a moment." |

### 2.9 Image paste warning

| Field | Value |
|-------|-------|
| **File** | `ChatComposer.tsx:79-82` |
| **Element** | Warning banner "This model does not support image input." |
| **Tooltip** | "This provider only supports text input. Images are ignored." |

---

## Phase 3 — Error / Fallback Pages

> 3 additions · 3 files · Simple

### 3.1 Loading skeleton

| Field | Value |
|-------|-------|
| **File** | `loading.tsx:7` |
| **Element** | Animated pulse placeholders |
| **Tooltip** | "The Studio is loading agent data and preparing the interface." |

### 3.2 Error fallback page

| Field | Value |
|-------|-------|
| **File** | `error.tsx:16-22` |
| **Element** | "Something went wrong" + Error ID |
| **Tooltip** | "An unexpected error occurred. This could be a network or server issue." |

### 3.3 404 Not Found

| Field | Value |
|-------|-------|
| **File** | `not-found.tsx:8-11` |
| **Element** | "Page not found" |
| **Tooltip** | "This URL does not exist in the Studio." |

---

## Phase 4 — Studio Hub Page

> 4 additions · 1 file · Simple

Add HelpTip to each feature card description in the Studio landing page grid.

### 4.1 "Talk to any member"

| Field | Value |
|-------|-------|
| **File** | `studio/page.tsx:54` |
| **Element** | `<h3>` + `<p>` feature card |
| **Tooltip** | "Each member's system prompt is synced from its SKILL.md file at build time." |

### 4.2 "Choose your provider"

| Field | Value |
|-------|-------|
| **File** | `studio/page.tsx:67` |
| **Element** | `<h3>` + `<p>` feature card |
| **Tooltip** | "Switch between 6 providers. Adjust temperature, max tokens, and model per conversation." |

### 4.3 "Server-side routing"

| Field | Value |
|-------|-------|
| **File** | `studio/page.tsx:80` |
| **Element** | `<h3>` + `<p>` feature card |
| **Tooltip** | "Requests go through the LLMRouter with automatic failover. Rate limited and logged." |

### 4.4 "Conversations saved"

| Field | Value |
|-------|-------|
| **File** | `studio/page.tsx:93` |
| **Element** | `<h3>` + `<p>` feature card |
| **Tooltip** | "Chat history persists in your browser between sessions via localStorage." |

---

## Phase 5 — Global / Non-Studio UI

> 9 additions · 4 files · Medium complexity (scattered across global components)

### 5.1 Navbar "New" badge on Studio link

| Field | Value |
|-------|-------|
| **File** | `Navbar.tsx:43-45` |
| **Element** | `<span>` "New" badge |
| **Tooltip** | "Agenthood Studio was recently added. Chat with agents live in your browser." |

### 5.2 Footer version badge

| Field | Value |
|-------|-------|
| **File** | `Footer.tsx:16-18` |
| **Element** | `<span>` version (e.g. "v3.5.2") |
| **Tooltip** | "The currently installed version of Agenthood. See the Releases page for history." |

### 5.3 Homepage stats — "16 Specialized agents"

| Field | Value |
|-------|-------|
| **File** | `page.tsx:72-74` |
| **Element** | Stats card |
| **Tooltip** | "Each agent has a unique role: architect, reviewer, tester, auditor, and more." |

### 5.4 Homepage stats — "Any Agent runtime"

| Field | Value |
|-------|-------|
| **File** | `page.tsx:76-78` |
| **Element** | Stats card |
| **Tooltip** | "Works with Claude Code, Copilot, Gemini CLI, OpenCode, or any skill-file runtime." |

### 5.5 Homepage stats — "Zero tolerance"

| Field | Value |
|-------|-------|
| **File** | `page.tsx:80-82` |
| **Element** | Stats card |
| **Tooltip** | "Enforces conventional commits — vague messages like 'fix stuff' are rejected." |

### 5.6 Homepage Studio preview cards (4 items)

| Field | Value |
|-------|-------|
| **File** | `page.tsx:118-130` |
| **Element** | 4 compact stat cards |
| **Tooltip** | Quick facts about Studio: 16 agents, 6 providers, SSE streaming, BYOK support. |

### 5.7 MarkdownRenderer copy code button

| Field | Value |
|-------|-------|
| **File** | `MarkdownRenderer.tsx:19-29` |
| **Element** | Copy icon `<button>` in code blocks |
| **Tooltip** | "Copies this code block to your clipboard." |

---

## Execution Status

All 5 phases completed in a single commit (`2c73648`).

| Phase | Status | Items | Files |
|-------|--------|-------|-------|
| 0 — CI fix | ✅ Resolved by earlier hardening commits | — | — |
| 1 — Section headers & toggles | ✅ Done | 4 | AgentConfigPanel, playground |
| 2 — Empty & error states | ✅ Done | 9 | ConversationList, LiveLogs, ChatComposer, playground, AgentConfigPanel |
| 3 — Fallback pages | ✅ Done | 3 | loading.tsx, error.tsx, not-found.tsx |
| 4 — Studio Hub | ✅ Done | 4 | studio/page.tsx |
| 5 — Global UI | ✅ Done | 9 | Navbar, Footer, Homepage, MarkdownRenderer |

Total HelpTip locations added: **59** (30 from PR #32 + 29 from PR #34).

## Execution Order

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
  2 files      5 files      3 files      1 file       4 files
  4 items      9 items      3 items      4 items      9 items
```

Each phase is independent — no cross-phase dependencies.  
Phases can be committed individually or as one batch.

## Verification

After each phase (or at the end):

```bash
npm run build
```

Expect: `✓ Compiled successfully` with zero TypeScript errors.

---

## Reference

- **Issue**: #21
- **PR (done)**: #32
- **Branch**: `feat/studio-help-tooltips`
- **Component**: `app/(main)/studio/_components/HelpTip.tsx`
