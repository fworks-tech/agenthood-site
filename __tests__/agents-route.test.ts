import { describe, it, expect } from "vitest";
import { GET } from "../app/api/studio/agents/route";

describe("GET /api/studio/agents", () => {
  it("returns the full agent directory without secrets", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.agents)).toBe(true);
    expect(body.agents.length).toBeGreaterThan(0);
    for (const agent of body.agents) {
      expect(typeof agent.id).toBe("string");
      expect(agent.id.length).toBeGreaterThan(0);
      expect(agent).not.toHaveProperty("apiKey");
      expect(agent).not.toHaveProperty("secret");
      expect(agent).not.toHaveProperty("preferredProvider");
    }
  });
});