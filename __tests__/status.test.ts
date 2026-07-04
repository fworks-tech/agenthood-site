import { describe, it, expect } from "vitest";

describe("GET /api/studio/status", () => {
  it("returns 200 with valid JSON", async () => {
    const { GET } = await import("../app/api/studio/status/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("agentsOnline");
    expect(typeof data.agentsOnline).toBe("number");
  });

  it("includes agent list with id, name, and status", async () => {
    const { GET } = await import("../app/api/studio/status/route");
    const res = await GET();
    const data = await res.json();

    expect(Array.isArray(data.agentStatuses)).toBe(true);
    expect(data.agentStatuses.length).toBeGreaterThan(0);

    for (const agent of data.agentStatuses) {
      expect(agent).toHaveProperty("id");
      expect(agent).toHaveProperty("name");
      expect(agent).toHaveProperty("status");
    }
  });

  it("includes kv status (falls back to unavailable in test)", async () => {
    const { GET } = await import("../app/api/studio/status/route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveProperty("kv");
    expect(data.kv).toHaveProperty("status");
    // In test environment without KV configured, should fall back gracefully
    expect(["connected", "unavailable"]).toContain(data.kv.status);
  });
});
