import { describe, it, expect } from "vitest";
import { agents } from "../app/(main)/studio/_data/agents";
import { agentRegistry } from "../app/(main)/studio/_data/registry.generated";

describe("agent registry alignment", () => {
  it("has 19 members matching the upstream registry count", () => {
    expect(agents.length).toBe(19);
    expect(agentRegistry.length).toBe(19);
  });

  it("has unique agent ids", () => {
    const ids = agents.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every member from the upstream registry", () => {
    const ids = new Set(agents.map((a) => a.id));
    for (const entry of agentRegistry) {
      expect(ids.has(entry.name), `missing agent for registry member ${entry.name}`).toBe(true);
    }
  });

  it("sources canonical metadata from the upstream registry", () => {
    const byId = new Map(agents.map((a) => [a.id, a]));
    for (const entry of agentRegistry) {
      const agent = byId.get(entry.name);
      if (!agent) continue;
      expect(agent.name).toBe(entry.displayName);
      expect(agent.shortDescription).toBe(entry.role);
      expect(agent.tagline).toBe(entry.tagline);
      expect(agent.stage).toEqual(entry.stage);
      expect(agent.priority).toBe(entry.priority);
    }
  });

  it("provides a non-empty role and short description for every agent", () => {
    for (const agent of agents) {
      expect(agent.role.length, `${agent.id} role`).toBeGreaterThan(0);
      expect(agent.shortDescription.length, `${agent.id} shortDescription`).toBeGreaterThan(0);
    }
  });
});
