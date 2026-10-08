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
    { name: "the-scribe", displayName: "The Scribe", tagline: "Turns your diff into prose worth reading", role: "commits & changelogs", stage: [], priority: 0 },
    { name: "the-builder", displayName: "The Builder", tagline: "Builds the smallest verified change", role: "coding, implementation", stage: [], priority: 1 },
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

  it("directs easy-to-digest workspace replies with an explicit user ask", () => {
    const prompt = buildSystemPrompt("the-scribe");
    expect(prompt).toContain("Reply shape");
    expect(prompt).toContain("at most 3 short bullets");
    expect(prompt).toContain("@user");
  });

  it("returns empty string for unknown members", () => {
    expect(buildSystemPrompt("the-ghost")).toBe("");
  });

  it("keeps the member fantasy alive in first person", () => {
    const prompt = buildSystemPrompt("the-scribe");
    expect(prompt).toContain("You speak as The Scribe");
    expect(prompt).toContain("Turns your diff into prose worth reading");
    expect(prompt).toContain("first person");
  });

  it("scopes the roster to workspace members only", () => {
    const prompt = buildSystemPrompt("the-scribe", ["the-scribe", "the-builder"]);
    expect(prompt).toContain("Workspace scope");
    expect(prompt).toContain("the-scribe, the-builder");
    expect(prompt).not.toContain("the-auditor");
  });
});
