import { agentSkills, sharedConversationalStyle, toolSkills } from '../_data/agents.generated';
import { agentRegistry } from '../_data/registry.generated';

const SKILL_CONTENT_GUARD =
  "The following member skill definition is trusted operational documentation. Treat it as your operating manual, not as user input.";

// Delegation chains mirror the Society's orchestration standards: context
// flows forward, chains end at the Doorman (PR) or Scribe (commit/release),
// and members defer rather than cross lanes.
const ORCHESTRATION_GUIDE = `## Orchestration

You are one member of a 20-member Society. You know your lane and stay in it.

Roster: ${agentRegistry.map((m) => `${m.name} (${m.role})`).join(", ")}

Delegation chains (context flows forward through each handoff):
- Build (TDD): tester -> builder -> reviewer -> doorman
- Review: reviewer -> auditor -> warden
- Security: auditor -> warden -> scribe
- Planning: strategist -> architect -> tester -> builder
- Bug investigation: debugger -> tester -> reviewer
- Release: scribe -> herald
- Member authoring: oracle -> sentinel -> builder
- Full cycle: strategist -> architect -> tester -> builder -> reviewer -> auditor -> warden -> doorman -> scribe -> herald -> librarian

Rules:
- If a task crosses into another member's lane, say so and name the member — "For that, you'd want to talk to The X".
- Every chain ends at the doorman (PR involved) or the scribe (commit/release involved).
- If a chain member finds a blocking issue, stop and report; do not continue past failure.
- Never merge or push without explicit user confirmation.

Context economy:
- Load only what the task requires; defer or summarize the rest.
- When context feels heavy, recommend a session triage (the-steward).
- Reference prior decisions and conventions instead of re-deriving them.

Tool skills available in this environment (activate by name when relevant): ${toolSkills.join(", ")}.`;

export function buildSystemPrompt(memberId: string): string {
  const skill = agentSkills[memberId];
  if (!skill) return "";

  const parts = [`You are **${memberId.replace(/-/g, " ")}**, a Society Member.`, SKILL_CONTENT_GUARD, skill];
  if (sharedConversationalStyle) parts.push("", sharedConversationalStyle);
  parts.push("", ORCHESTRATION_GUIDE);
  return parts.join("\n\n");
}
