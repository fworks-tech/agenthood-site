// Curated conversational starter prompts for the Playground Chat empty state.
// Phrased as messages you would actually send the member, unlike the
// "When to Use" bullets in agentPrompts.generated.ts (which document CLI usage).

export const agentStarters: Record<string, string[]> = {
  "the-architect": [
    "Plan the implementation for a notification feature",
    "Break down this spec into a task list: <paste spec>",
    "Which state library should we pick, and why?",
  ],
  "the-auditor": [
    "Scan the auth flow for vulnerabilities",
    "Audit our dependencies for known CVEs",
    "Review this endpoint for input validation gaps",
  ],
  "the-builder": [
    "Fix the session timeout bug in the auth module",
    "Refactor the checkout flow to the repository's existing patterns",
    "Implement the task list from the architect's spec",
  ],
  "the-debugger": [
    "Diagnose why the CI pipeline is failing",
    "A test started failing after an unrelated change — help me find the cause",
    "I can't reproduce this bug report. Walk me through isolation",
  ],
  "the-doorman": [
    "Validate all commit messages on this branch",
    "Run a repository health check before merge",
    "Which enforcement hooks does this project still miss?",
  ],
  "the-envoy": [
    "Translate our skills for a Copilot-only team",
    "We're migrating from Claude Code — what changes?",
    "Audit whether conventions hold across all our runtimes",
  ],
  "the-herald": [
    "Prepare release notes for v2.1.0",
    "What version bump does this change set deserve?",
    "Summarize what shipped this week",
  ],
  "the-inspector": [
    "Which panel contains the smallest item in this figure?",
    "Rank these image regions by pixel brightness",
    "Verify my benchmark answer against the ground truth",
  ],
  "the-librarian": [
    "The payments module has no docs — write them",
    "Record an ADR for the queue migration decision",
    "Update the README setup steps for the new CLI",
  ],
  "the-mailman": [
    "Schedule this announcement across our channels",
    "A notification failed to deliver — investigate",
    "Audit our delivery pipeline for reliability gaps",
  ],
  "the-mediator": [
    "Which member should handle this request?",
    "Sequence the handoff for a full dev cycle task",
    "This prompt is ambiguous — classify the intent first",
  ],
  "the-operator": [
    "The deployment looks degraded — verify and roll back if needed",
    "Runtime health checks are failing, triage the incident",
    "Validate the rollback result",
  ],
  "the-oracle": [
    "Why does the Society require one branch per issue?",
    "I want to add a new member — where do I start?",
    "What must I update when adding a new portal?",
  ],
  "the-reviewer": [
    "Review the open PR #128",
    "Review my bug fix and its regression test",
    "Evaluate code another agent produced",
  ],
  "the-scribe": [
    "Write a commit message for the current diff",
    "Draft a PR description from my branch",
    "Generate changelog entries for this release",
  ],
  "the-sentinel": [
    "Audit my new member file for lane overlap",
    "A convention changed — which members reference the old rule?",
    "Check the Society docs for contradictions",
  ],
  "the-steward": [
    "Which members does this task actually require?",
    "My context feels heavy — run a session triage",
    "Route member loading for cross-provider caching",
  ],
  "the-strategist": [
    "Our goal is 'ship faster' — refine that into success criteria",
    "Two stakeholders disagree on scope — structure the tradeoff",
    "This feature request lacks acceptance metrics",
  ],
  "the-tester": [
    "Write tests for the checkout flow (TDD: failing test first)",
    "Add regression tests after this bug fix",
    "Assess whether our test coverage is meaningful",
  ],
  "the-warden": [
    "Scan src/ for code smells",
    "Did this refactor introduce new coupling?",
    "Run a full codebase scan for a health baseline",
  ],
};
