import { describe, it, expect, vi } from "vitest";

vi.mock("../app/(main)/studio/_data/agents.generated", () => ({
  agentSkills: {
    "the-scribe": "Skill body: write commit messages.",
    "the-ghost": undefined,
  },
  sharedConversationalStyle: "You are a person, not a tool.",
  toolSkills: ["github", "docker"],
}));

vi.mock("../app/(main)/studio/_data/registry.generated", () => ({
  agentRegistry: [
    { name: "the-scribe", displayName: "The Scribe", tagline: "", role: "commits & changelogs", stage: [], priority: 0 },
  ],
}));

import { buildSystemPrompt } from "../app/(main)/studio/_lib/system-prompt";

describe("buildSystemPrompt", () => {
  it("composes skill body, conversational style, and orchestration guide", () => {
    const prompt = buildSystemPrompt("the-scribe");
    expect(prompt).toContain("Skill body: write commit messages.");
    expect(prompt).toContain("You are a person, not a tool.");
    expect(prompt).toContain("## Orchestration");
    expect(prompt).toContain("tester -> builder -> reviewer -> doorman");
    expect(prompt).toContain("the-scribe (commits & changelogs)");
    expect(prompt).toContain("github, docker");
  });

  it("returns empty string for unknown members", () => {
    expect(buildSystemPrompt("the-ghost")).toBe("");
  });
});
